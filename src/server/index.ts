import cors from 'cors';
import dotenv from 'dotenv';
/* eslint-disable no-console */
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import nodeFetch from 'node-fetch';

import { runActualScraping } from '@/dev-cli/scraper';
import { processOptions } from '@/dev-cli/validate';
import { segmentRateLimiter } from '@/server/rate-limiter';
import { getStats, updateProviderStats } from '@/server/stats';
import { encryptPlaylistContent, generateStreamToken, getStreamMetadata } from '@/server/stream-proxy';
import { turnstileMiddleware } from '@/server/turnstile';

import { getBuiltinEmbeds, getBuiltinExternalSources, getBuiltinSources } from '..';
import { generateCacheKey, getCachedStream, setCachedStream } from './redis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// Trust proxy - REQUIRED when behind reverse proxy (Koyeb, Cloudflare, etc.)
// This allows Express to correctly identify client IPs from X-Forwarded-For header
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for localhost in development
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
});

// Aggressive rate limiting for scraping endpoint
const scrapingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit to 20 scraping requests per 5 minutes
  message: 'Too many scraping requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
});

// Speed limiter - slows down requests after threshold
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per 15 minutes at full speed
  delayMs: () => 500, // Fixed 500ms delay per request after threshold
  maxDelayMs: 5000, // Maximum delay of 5 seconds
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
});

// Apply rate limiting to all routes
app.use(apiLimiter);
app.use(speedLimiter);

// Cloudflare headers validation (when behind Cloudflare)
const cloudflareValidation = (req: Request, res: Response, next: () => void) => {
  // If CLOUDFLARE_MODE is enabled, validate CF headers
  if (process.env.CLOUDFLARE_MODE === 'true') {
    const cfRay = req.get('cf-ray');
    const cfConnectingIp = req.get('cf-connecting-ip');

    // If headers are missing, request might not be from Cloudflare
    if (!cfRay && !cfConnectingIp) {
      console.log('[SECURITY] Request without Cloudflare headers from:', req.ip);
      // In strict mode, block non-Cloudflare requests
      if (process.env.CLOUDFLARE_STRICT === 'true') {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
  }
  next();
};

app.use(cloudflareValidation);

// Allowed domains for stream access (from environment)
const ALLOWED_DOMAINS = process.env.ALLOWED_DOMAINS
  ? process.env.ALLOWED_DOMAINS.split(',').map((d) => d.trim())
  : ['localhost:3000', 'localhost:3001']; // Default for development

console.log('Allowed domains for stream access:', ALLOWED_DOMAINS);

// Domain validation middleware for stream endpoints
function validateDomain(req: Request, res: Response, next: () => void) {
  const referer = req.get('referer') || req.get('origin') || '';
  const host = req.get('host') || '';

  // 1. BLOCK Direct Access (No Referer)
  // This prevents users from copying the URL and opening it in a new tab
  if (!referer) {
    console.log(`[BLOCKED] Direct URL access attempt (No Referer) from IP: ${req.ip}`);
    return res.status(403).send('Access denied: Direct access not allowed');
  }

  // 2. Allow requests from the same host (e.g. your own frontend)
  // This allows localhost:3000 -> localhost:3000
  if (referer.includes(host)) {
    return next();
  }

  // 3. Check against ALLOWED_DOMAINS list
  const isAllowed = ALLOWED_DOMAINS.some((domain) => referer.includes(domain) || referer.includes(`://${domain}`));

  if (isAllowed) {
    return next();
  }

  // 4. Block everything else
  console.log(`[BLOCKED] Unauthorized domain access from: ${referer}`);
  return res.status(403).send('Access denied: Domain not authorized');
}

// Serve test page
app.get('/test', (req: Request, res: Response) => {
  res.sendFile('test-api.html', { root: process.cwd() });
});

// Load sources
const sourceScrapers = [...getBuiltinSources(), ...getBuiltinExternalSources()].sort((a, b) => b.rank - a.rank);
const embedScrapers = getBuiltinEmbeds().sort((a, b) => b.rank - a.rank);
const sources = [...sourceScrapers, ...embedScrapers];

// Middleware for API Key authentication
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!API_KEY) {
    console.warn('API_KEY not set in environment variables. allowing all requests (NOT RECOMMENDED)');
    return next();
  }

  if (apiKey === API_KEY) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
};

app.get('/sources', authMiddleware, (req: Request, res: Response) => {
  const sourceList = sources.map((source) => ({
    id: source.id,
    name: source.name,
    rank: source.rank,
    type: source.type,
    mediaTypes: source.mediaTypes || [],
  }));
  res.json(sourceList);
});

app.get('/status', (req: Request, res: Response) => {
  const stats = getStats();
  const result: Record<string, { status: string; responseTime: number; uptime: number }> = {};

  // Get all source providers (not embeds)
  const sourceProviders = sources.filter((s) => s.type === 'source');

  // Add all source providers to the result
  for (const provider of sourceProviders) {
    if (stats[provider.id]) {
      // Provider has been tested
      result[provider.id] = stats[provider.id];
    } else {
      // Provider hasn't been tested yet
      result[provider.id] = {
        status: 'untested',
        responseTime: 0,
        uptime: 0,
      };
    }
  }

  res.json(result);
});

// Get stream URL endpoint with aggressive rate limiting and Turnstile protection
app.get('/cdn', authMiddleware, scrapingLimiter, turnstileMiddleware, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { sourceId, tmdbId, type, season, episode, url, force } = req.query;

    if (!sourceId) {
      return res.status(400).json({ error: 'Missing sourceId' });
    }

    const sId = String(sourceId);
    const tId = String(tmdbId || '');
    const mType = String(type || 'movie');
    const sSeason = String(season || '0');
    const sEpisode = String(episode || '0');
    const sUrl = String(url || '');

    // Check cache (by TMDB ID)
    const cacheKey = generateCacheKey(sId, tId, mType, sSeason, sEpisode);
    if (force !== 'true') {
      const cached = await getCachedStream(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] ${cacheKey}`);
        const responseTime = Date.now() - startTime;
        updateProviderStats(sId, true, responseTime);

        // Generate FRESH tokens even for cached results
        const proxiedResult = {
          ...cached,
          stream: cached.stream?.map((stream: any) => {
            // NEW token for each request with IP/UA binding
            const token = generateStreamToken(stream.playlist, stream.headers || {}, req.ip, req.get('user-agent'));
            return {
              ...stream,
              playlist: `${req.protocol}://${req.get('host')}/s/${token}`,
              headers: {},
            };
          }),
        };

        return res.json(proxiedResult);
      }
    }

    console.log(`[Scraping] ${sId} - ${mType} ${tId}`);

    // Prepare options for scraper
    const options = {
      fetcher: 'native',
      sourceId: sId,
      tmdbId: tId,
      type: mType,
      season: sSeason,
      episode: sEpisode,
      url: sUrl,
    };

    // Process options and run scraper
    const { providerOptions, source: validatedSource, options: validatedOps } = await processOptions(sources, options);

    const result = await runActualScraping(providerOptions, validatedSource, validatedOps);

    if (result) {
      // Fetch metadata from TMDB
      const { getMediaMetadata } = await import('./tmdb');
      const metadata = await getMediaMetadata(tId, mType as 'movie' | 'show', sSeason, sEpisode);

      // Cache the RAW result with metadata
      const cacheData = {
        ...result,
        metadata: metadata
          ? {
              ...metadata,
              scrapedAt: new Date().toISOString(),
              timestamp: Date.now(),
            }
          : undefined,
      };

      await setCachedStream(cacheKey, cacheData);
      const responseTime = Date.now() - startTime;
      updateProviderStats(sId, true, responseTime);

      // Generate FRESH tokens for this request (even if from cache)
      const proxiedResult = {
        ...result,
        stream: result.stream?.map((stream: any) => {
          // Generate a NEW token for each request with IP/UA binding
          const token = generateStreamToken(stream.playlist, stream.headers || {}, req.ip, req.get('user-agent'));
          return {
            ...stream,
            playlist: `${req.protocol}://${req.get('host')}/s/${token}`,
            headers: {}, // Remove headers from response since proxy handles them
          };
        }),
      };

      return res.json(proxiedResult);
    }

    const responseTime = Date.now() - startTime;
    updateProviderStats(sId, false, responseTime);
    return res.status(404).json({ error: 'Stream not found' });
  } catch (error: any) {
    console.error('Scraping Error:', error);
    const sId = String(req.query.sourceId || 'unknown');
    const responseTime = Date.now() - startTime;
    updateProviderStats(sId, false, responseTime);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Stream proxy endpoint (opaque token format) - PROTECTED
app.get('/s/:token', validateDomain, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const ip = req.ip || '';
    const userAgent = req.get('user-agent') || '';

    const metadata = await getStreamMetadata(token, ip, userAgent);

    if (!metadata) {
      return res.status(404).send('Not found');
    }

    // Fetch the master playlist
    const response = await nodeFetch(metadata.url, {
      headers: metadata.headers,
    });

    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch');
    }

    const content = await response.text();

    console.log('[STREAM PROXY] Original playlist URL:', metadata.url);
    console.log('[STREAM PROXY] Original playlist length:', content.length);

    // Extract available qualities from master playlist
    const qualityRegex = /RESOLUTION=(\d+x\d+)/g;
    const qualities = Array.from(content.matchAll(qualityRegex)).map((m) => m[1]);
    if (qualities.length > 0) {
      console.log('[STREAM PROXY] Available qualities:', qualities.join(', '));
    }

    // Process the playlist to replace URLs with proxied versions
    // Pass IP and UA for segment token binding
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const proxiedContent = await encryptPlaylistContent(content, baseUrl, token, metadata.url, ip, userAgent);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(proxiedContent);
  } catch (error: any) {
    console.error('Stream proxy error:', error);
    res.status(500).send('Error');
  }
});

// Segment proxy endpoint (opaque format) - PROTECTED with IP/UA binding and rate limiting
app.get('/s/:token/chunk/:segmentToken', validateDomain, async (req: Request, res: Response) => {
  try {
    const { token, segmentToken } = req.params;
    const ip = req.ip || '';
    const userAgent = req.get('user-agent') || '';

    // Check for download tools
    if (segmentRateLimiter.detectDownloadTool(userAgent)) {
      console.log(`[SECURITY] Download tool detected: ${userAgent.substring(0, 100)} from IP: ${ip}`);
      return res.status(403).send('Download tools are not permitted');
    }

    // Rate limit check
    const rateLimitResult = await segmentRateLimiter.checkRateLimit(token, ip);
    if (!rateLimitResult.allowed) {
      console.log(`[RATE LIMIT] Blocked ${ip} - ${rateLimitResult.reason}`);
      return res.status(429).send(rateLimitResult.reason || 'Too many requests');
    }

    // Validate master token
    const metadata = await getStreamMetadata(token, ip, userAgent);

    if (!metadata) {
      return res.status(404).send('Not found');
    }

    // Verify and decrypt the encrypted segment token
    const { verifyEncryptedSegmentToken } = await import('./stream-proxy');
    const segmentData = await verifyEncryptedSegmentToken(segmentToken, token);

    if (!segmentData) {
      return res.status(404).send('Not found');
    }

    const segmentUrl = segmentData.url;

    // Fetch the segment with proper headers
    const response = await nodeFetch(segmentUrl, {
      headers: metadata.headers,
    });

    if (!response.ok) {
      return res.status(response.status).send('Failed');
    }

    const contentType = response.headers.get('content-type') || '';

    // Check if this is a sub-playlist (variant m3u8) that needs URL rewriting
    const isPlaylist = contentType.includes('mpegurl') || contentType.includes('m3u8') || segmentUrl.includes('.m3u8');

    if (isPlaylist) {
      // This is a sub-playlist, rewrite its URLs
      const content = await response.text();

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const proxiedContent = await encryptPlaylistContent(content, baseUrl, token, segmentUrl, ip, userAgent);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(proxiedContent);
    } else {
      // This is an actual video segment, stream it with aggressive buffering headers
      const contentLength = response.headers.get('content-length');

      res.setHeader('Content-Type', contentType || 'video/mp2t');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Aggressive buffering headers
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
      res.setHeader('Accept-Ranges', 'bytes'); // Enable range requests

      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      if (response.body) {
        response.body.pipe(res as any);
      }
    }
  } catch (error: any) {
    console.error('Segment proxy error:', error);
    res.status(500).send('Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

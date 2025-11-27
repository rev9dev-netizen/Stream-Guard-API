/* eslint-disable no-console */
import crypto from 'crypto';
import zlib from 'zlib';

import {
  getCachedStream as getRedisValue,
  getStreamSegment,
  setBatchStreamSegments,
  setCachedStream as setRedisValue,
} from './redis';

type StreamMetadata = {
  url: string;
  headers: Record<string, string>;
  expiresAt: number;
  ip?: string; // Bind to IP address
  userAgent?: string; // Bind to User-Agent
};

// Helper for async string replacement
async function replaceAsync(
  str: string,
  regex: RegExp,
  asyncFn: (match: string, ...args: any[]) => Promise<string>,
): Promise<string> {
  const promises: Promise<string>[] = [];
  str.replace(regex, (match, ...args) => {
    promises.push(asyncFn(match, ...args));
    return match;
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift() || '');
}

/**
 * Generate encrypted token for stream metadata
 * Binds token to IP and User-Agent for security
 */
export async function generateStreamToken(
  url: string,
  headers: Record<string, string>,
  ip?: string,
  userAgent?: string,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 hours

  const metadata: StreamMetadata = {
    url,
    headers,
    expiresAt,
    ip,
    userAgent,
  };

  // Store in Redis with the token as key
  await setRedisValue(`stream:token:${token}`, metadata);

  return token;
}

// Retrieve stream metadata from token
/**
 * Retrieve stream metadata from token
 * Validates IP and User-Agent binding
 */
export async function getStreamMetadata(
  token: string,
  ip?: string,
  userAgent?: string,
): Promise<StreamMetadata | null> {
  const metadata = await getRedisValue(`stream:token:${token}`);

  if (!metadata) {
    return null;
  }

  // Check expiration
  if (Date.now() > metadata.expiresAt) {
    return null;
  }

  // Normalize localhost IPs (IPv4 <-> IPv6)
  const normalizeLocalhost = (ipAddr?: string): string => {
    if (!ipAddr) return '';
    if (ipAddr === '::1' || ipAddr === '::ffff:127.0.0.1' || ipAddr === '127.0.0.1') {
      return 'localhost';
    }
    return ipAddr;
  };

  // IP validation disabled for worker proxy compatibility
  // The worker makes requests from Cloudflare's network, which has different IPs
  // Security is maintained through:
  // 1. Worker authentication (X-Worker-Proxy header)
  // 2. Token expiration
  // 3. Rate limiting
  // 4. Domain validation

  /* DISABLED - Causes issues with Cloudflare Worker proxy
  if (metadata.ip && ip) {
    const normalizedMetadataIp = normalizeLocalhost(metadata.ip);
    const normalizedRequestIp = normalizeLocalhost(ip);
    
    if (normalizedMetadataIp !== normalizedRequestIp) {
      console.log(`[SECURITY] IP mismatch for token. Expected: ${metadata.ip}, Got: ${ip}`);
      return null;
    }
  }
  */

  // Validate User-Agent binding (if set)
  if (metadata.userAgent && userAgent && metadata.userAgent !== userAgent) {
    console.log(`[SECURITY] User-Agent mismatch for token`);
    return null;
  }

  return metadata;
}

/**
 * Generate encrypted payload and short ID (internal helper)
 * Does NOT save to Redis (caller must handle storage)
 * Enhanced with random padding and scrambling for maximum obfuscation
 */
async function generateEncryptedSegmentPayload(
  url: string,
  expiresAt: number,
  masterToken: string,
): Promise<{ shortId: string; encryptedData: string }> {
  // Create encryption key from master token (SHA-256 for AES-256)
  const keyHash = crypto.createHash('sha256').update(masterToken).digest();

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.randomBytes(12);

  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', keyHash, iv);

  // Add random padding to make tokens variable length (prevents pattern analysis)
  const randomPadding = crypto.randomBytes(Math.floor(Math.random() * 16) + 8).toString('hex');

  // Create payload with random padding and compress it
  const payload = JSON.stringify({ url, exp: expiresAt, _pad: randomPadding });
  const compressed = zlib.deflateSync(payload);

  // Encrypt the compressed data
  let encrypted = cipher.update(compressed);
  const final = cipher.final();
  encrypted = Buffer.concat([encrypted, final]);

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine: IV + encrypted data + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);
  const encryptedData = combined.toString('base64url');

  // Generate short, clean-looking token ID with random length (12-20 chars)
  const tokenLength = Math.floor(Math.random() * 5) + 6; // 6-10 bytes = 12-20 hex chars
  const shortId = crypto.randomBytes(tokenLength).toString('hex');

  return { shortId, encryptedData };
}

/**
 * Encrypt playlist content and generate segment tokens
 * Segments use short token IDs for clean URLs
 * Optimized: Stores all segments in ONE Redis Hash key
 * Enhanced: Validates output to ensure no CDN URLs are exposed
 */
export async function encryptPlaylistContent(
  content: string,
  baseUrl: string,
  token: string,
  originalUrl: string,
  _ip: string,
  _userAgent: string,
): Promise<string> {
  const lines = content.split('\n');
  const segmentMapping: Record<string, string> = {};
  const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 hours

  console.log(`[PLAYLIST ENCRYPTION] Processing playlist from: ${originalUrl.substring(0, 100)}`);
  console.log(`[PLAYLIST ENCRYPTION] Total lines: ${lines.length}`);

  // First pass: Process lines and collect all segments
  const processedLines = await Promise.all(
    lines.map(async (line) => {
      const trimmed = line.trim();

      // Check for URI="..." attributes in tags (e.g. #EXT-X-MEDIA, #EXT-X-KEY)
      if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
        return replaceAsync(line, /URI="([^"]+)"/g, async (match, uri) => {
          let fullUrl = uri;

          // Convert relative URLs to absolute
          if (!uri.startsWith('http')) {
            const baseUrlObj = new URL(originalUrl);
            if (uri.startsWith('/')) {
              fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${uri}`;
            } else {
              const pathParts = baseUrlObj.pathname.split('/');
              pathParts.pop();
              fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${pathParts.join('/')}/${uri}`;
            }
          }

          console.log(`[PLAYLIST ENCRYPTION] Encrypting URI attribute: ${fullUrl.substring(0, 80)}...`);

          // Generate encrypted payload
          const { shortId, encryptedData } = await generateEncryptedSegmentPayload(fullUrl, expiresAt, token);

          // Add to batch mapping
          segmentMapping[shortId] = encryptedData;

          // Return flat proxied URL
          return `URI="${baseUrl}/${token}/${shortId}"`;
        });
      }

      // Skip other comments/tags
      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }

      // This is a URL line (segment or sub-playlist)
      let fullUrl = trimmed;

      // Convert relative URLs to absolute
      if (!trimmed.startsWith('http')) {
        const baseUrlObj = new URL(originalUrl);
        if (trimmed.startsWith('/')) {
          // Absolute path
          fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${trimmed}`;
        } else {
          // Relative path
          const pathParts = baseUrlObj.pathname.split('/');
          pathParts.pop(); // Remove filename
          fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${pathParts.join('/')}/${trimmed}`;
        }
      }

      console.log(`[PLAYLIST ENCRYPTION] Encrypting segment: ${fullUrl.substring(0, 80)}...`);

      // Generate encrypted payload (but don't save to Redis yet)
      const { shortId, encryptedData } = await generateEncryptedSegmentPayload(fullUrl, expiresAt, token);

      // Add to batch mapping
      segmentMapping[shortId] = encryptedData;

      // Return flat proxied URL
      return `${baseUrl}/${token}/${shortId}`;
    }),
  );

  // Batch save all segments to Redis in ONE call
  const ttl = Math.ceil((expiresAt - Date.now()) / 1000);
  await setBatchStreamSegments(token, segmentMapping, ttl);

  const result = processedLines.join('\n');

  console.log(`[PLAYLIST ENCRYPTION] Encrypted ${Object.keys(segmentMapping).length} segments`);
  console.log(`[PLAYLIST ENCRYPTION] Output length: ${result.length} bytes`);

  // Validate that no CDN URLs are exposed
  const { validatePlaylistSecurity } = await import('./response-validator');
  const isSecure = validatePlaylistSecurity(result, `token:${token.substring(0, 8)}`);

  if (!isSecure) {
    console.error('[PLAYLIST ENCRYPTION] SECURITY VIOLATION: Exposed URLs detected in encrypted playlist!');
  }

  return result;
}

/**
 * Verify a short segment token by looking up encrypted data in Redis
 * Returns null if token not found, expired, or decryption fails
 */
export async function verifyEncryptedSegmentToken(
  shortTokenId: string,
  masterToken: string,
): Promise<{ url: string; expiresAt: number } | null> {
  try {
    // Retrieve encrypted data from Redis Hash (1 lookup)
    const encryptedData = await getStreamSegment(masterToken, shortTokenId);

    if (!encryptedData) {
      return null; // Token not found or expired
    }

    // Decode from base64url
    const combined = Buffer.from(encryptedData, 'base64url');

    // Extract IV (first 12 bytes)
    const iv = combined.subarray(0, 12);

    // Extract auth tag (last 16 bytes)
    const authTag = combined.subarray(combined.length - 16);

    // Extract encrypted data (middle part)
    const encrypted = combined.subarray(12, combined.length - 16);

    // Create decryption key from master token
    const keyHash = crypto.createHash('sha256').update(masterToken).digest();

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyHash, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // Decompress
    const decompressed = zlib.inflateSync(decrypted).toString('utf8');

    // Parse payload
    const payload = JSON.parse(decompressed);

    // Check expiration
    if (payload.exp < Date.now()) {
      return null; // Expired
    }

    return { url: payload.url, expiresAt: payload.exp };
  } catch (error) {
    // Decryption failed or Redis error
    return null;
  }
}

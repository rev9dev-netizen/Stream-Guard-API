/* eslint-disable no-console */
import crypto from 'crypto';

import { getCachedStream as getRedisValue, setCachedStream as setRedisValue } from './redis';

type StreamMetadata = {
  url: string;
  headers: Record<string, string>;
  expiresAt: number;
  ip?: string; // Bind to IP address
  userAgent?: string; // Bind to User-Agent
};

type SegmentMetadata = {
  url: string;
  expiresAt: number;
  ip: string;
  userAgent: string;
  used: boolean; // One-time use flag
};

/**
 * Generate encrypted token for stream metadata
 * Binds token to IP and User-Agent for security
 */
export function generateStreamToken(
  url: string,
  headers: Record<string, string>,
  ip?: string,
  userAgent?: string,
): string {
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
  setRedisValue(`stream:token:${token}`, metadata);

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

  // Validate IP binding (if set)
  if (metadata.ip && ip && metadata.ip !== ip) {
    console.log(`[SECURITY] IP mismatch for token. Expected: ${metadata.ip}, Got: ${ip}`);
    return null;
  }

  // Validate User-Agent binding (if set)
  if (metadata.userAgent && userAgent && metadata.userAgent !== userAgent) {
    console.log(`[SECURITY] User-Agent mismatch for token`);
    return null;
  }

  return metadata;
}

/**
 * Encrypt playlist content and generate segment tokens
 * Each segment gets a unique token with 3-second expiry and one-time use
 */
export function encryptPlaylistContent(
  content: string,
  baseUrl: string,
  token: string,
  originalUrl: string,
  ip: string,
  userAgent: string,
): string {
  const lines = content.split('\n');
  const processedLines = lines.map((line) => {
    const trimmed = line.trim();

    // Skip comments and empty lines
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

    // Generate a unique segment token with ultra-short expiry
    const segmentToken = crypto.randomBytes(16).toString('hex');

    // Store segment metadata with IP/UA binding and 3-second expiry
    const segmentKey = `segment:${token}:${segmentToken}`;
    const segmentMetadata: SegmentMetadata = {
      url: fullUrl,
      expiresAt: Date.now() + 3000, // 3 seconds!
      ip,
      userAgent,
      used: false, // One-time use flag
    };

    setRedisValue(segmentKey, segmentMetadata);

    // Return proxied URL (opaque format) - NO URL in query params
    return `${baseUrl}/s/${token}/chunk/${segmentToken}`;
  });

  return processedLines.join('\n');
}

/**
 * Get and validate segment metadata
 * Checks IP/UA binding, expiry, and one-time use
 */
export async function getSegmentMetadata(
  token: string,
  segmentToken: string,
  ip: string,
  userAgent: string,
): Promise<string | null> {
  const segmentKey = `segment:${token}:${segmentToken}`;
  const metadata: SegmentMetadata | null = await getRedisValue(segmentKey);

  if (!metadata) {
    console.log(`[SECURITY] Segment not found: ${segmentToken}`);
    return null;
  }

  // Check if already used (one-time use)
  if (metadata.used) {
    console.log(`[SECURITY] Segment already used: ${segmentToken}`);
    return null;
  }

  // Check expiration (3 seconds)
  if (Date.now() > metadata.expiresAt) {
    console.log(`[SECURITY] Segment expired: ${segmentToken}`);
    return null;
  }

  // Validate IP binding
  if (metadata.ip !== ip) {
    console.log(`[SECURITY] IP mismatch for segment. Expected: ${metadata.ip}, Got: ${ip}`);
    return null;
  }

  // Validate User-Agent binding
  if (metadata.userAgent !== userAgent) {
    console.log(`[SECURITY] User-Agent mismatch for segment`);
    return null;
  }

  // Mark as used (one-time use)
  metadata.used = true;
  await setRedisValue(segmentKey, metadata);

  return metadata.url;
}

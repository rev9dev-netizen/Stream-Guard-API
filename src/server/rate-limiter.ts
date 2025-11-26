/* eslint-disable no-console */
import { getCachedStream as getRedisValue, setCachedStream as setRedisValue } from './redis';

interface RateLimitData {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

/**
 * Rate limiting for segment downloads
 * Tracks requests per token and IP to detect bulk downloading
 */
export class SegmentRateLimiter {
  private maxSegmentsPerMinute = 500; // Allow 500 segments/min (accommodates fast seeking/buffering)
  private maxBurstSegments = 100; // Max segments in 5 seconds (burst)

  private burstWindowMs = 5000; // 5 seconds

  /**
   * Check if request should be allowed
   * Returns true if allowed, false if rate limited
   */
  async checkRateLimit(token: string, ip: string): Promise<{ allowed: boolean; reason?: string }> {
    const key = `ratelimit:${token}:${ip}`;
    const data: RateLimitData | null = await getRedisValue(key);

    const now = Date.now();

    if (!data) {
      // First request
      await this.recordRequest(key, now);
      return { allowed: true };
    }

    // Check burst rate (too many requests in 5 seconds)
    const timeSinceFirst = now - data.firstRequest;
    if (timeSinceFirst < this.burstWindowMs && data.count >= this.maxBurstSegments) {
      console.log(`[RATE LIMIT] Burst limit exceeded for ${ip} - ${data.count} requests in ${timeSinceFirst}ms`);
      return {
        allowed: false,
        reason: 'Too many requests. Please wait a moment.',
      };
    }

    // Check sustained rate (too many requests per minute)
    const oneMinuteAgo = now - 60000;
    if (data.firstRequest > oneMinuteAgo) {
      // All requests within last minute
      if (data.count >= this.maxSegmentsPerMinute) {
        console.log(`[RATE LIMIT] Sustained limit exceeded for ${ip} - ${data.count} requests/min`);
        return {
          allowed: false,
          reason: 'Rate limit exceeded. Are you trying to download this video?',
        };
      }
    } else {
      // Reset counter if window has passed
      await this.recordRequest(key, now, undefined, true);
      return { allowed: true };
    }

    // Update counter
    await this.recordRequest(key, now, data, false);
    return { allowed: true };
  }

  /**
   * Record a request
   */
  private async recordRequest(key: string, now: number, existingData?: RateLimitData, reset = false): Promise<void> {
    const data: RateLimitData =
      reset || !existingData
        ? {
            count: 1,
            firstRequest: now,
            lastRequest: now,
          }
        : {
            count: existingData.count + 1,
            firstRequest: existingData.firstRequest,
            lastRequest: now,
          };

    // Store with 60 second expiry
    await setRedisValue(key, data);
  }

  /**
   * Check User-Agent for known download tools
   */
  detectDownloadTool(userAgent: string): boolean {
    const downloadTools = [
      'ffmpeg',
      'youtube-dl',
      'yt-dlp',
      'curl',
      'wget',
      'aria2',
      'IDM', // Internet Download Manager
      'streamlink',
      'vlc',
      'python-requests',
      'Lavf', // ffmpeg library
    ];

    const ua = userAgent.toLowerCase();
    return downloadTools.some((tool) => ua.includes(tool.toLowerCase()));
  }
}

export const segmentRateLimiter = new SegmentRateLimiter();

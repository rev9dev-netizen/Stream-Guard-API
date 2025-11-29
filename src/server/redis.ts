/* eslint-disable no-console */
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;

if (redisUrl && redisToken) {
  console.log('Initializing Redis connection...');
  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
} else {
  console.warn('UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set, caching will be disabled');
}

const CACHE_TTL = 60 * 60 * 4; // 4 hours

export async function getCachedStream(key: string): Promise<any | null> {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    return data;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

export async function setCachedStream(key: string, data: any, ttl: number = CACHE_TTL): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, data, { ex: ttl });
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

export async function setBatchStreamSegments(
  masterToken: string,
  mapping: Record<string, string>,
  ttl: number = CACHE_TTL,
): Promise<void> {
  if (!redis) return;
  try {
    const key = `seg:${masterToken}`;
    // Store all mappings in one Hash
    await redis.hset(key, mapping);
    // Set expiry for the whole hash
    await redis.expire(key, ttl);
  } catch (error) {
    console.error('Redis batch set error:', error);
  }
}

export async function getStreamSegment(masterToken: string, shortId: string): Promise<string | null> {
  if (!redis) return null;
  try {
    const key = `seg:${masterToken}`;
    return await redis.hget(key, shortId);
  } catch (error) {
    console.error('Redis hash get error:', error);
    return null;
  }
}

export function generateCacheKey(
  sourceId: string,
  tmdbId: string,
  type: string,
  season?: string,
  episode?: string,
): string {
  return `stream:${sourceId}:${tmdbId}:${type}:${season || '0'}:${episode || '0'}`;
}

// Health Check Storage
export async function saveProviderHealth(sourceId: string, data: any): Promise<void> {
  if (!redis) return;
  try {
    await redis.hset('provider:health', { [sourceId]: JSON.stringify(data) });
  } catch (error) {
    console.error('Redis health save error:', error);
  }
}

export async function getProviderHealth(sourceId: string): Promise<any | null> {
  if (!redis) return null;
  try {
    const data = await redis.hget('provider:health', sourceId);

    // Upstash Redis might return the object directly if it was stored as JSON
    if (typeof data === 'object' && data !== null) {
      return data;
    }

    // If it's a string, try to parse it
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        // If parsing fails, it might be double-encoded or invalid
        console.warn(`Failed to parse health data for ${sourceId}:`, e);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('Redis health get error:', error);
    return null;
  }
}

export async function getAllProviderHealth(): Promise<Record<string, any>> {
  if (!redis) return {};
  try {
    const data = await redis.hgetall('provider:health');
    if (!data) return {};
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      try {
        result[key] = JSON.parse(value as string);
      } catch (e) {
        result[key] = value;
      }
    }
    return result;
  } catch (error) {
    console.error('Redis all health get error:', error);
    return {};
  }
}

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Fallback in-memory map if Redis is not configured
const memoryCache = new Map<string, { count: number; expires: number }>();

const ratelimitCache: Map<string, Ratelimit> = new Map();

function getMemoryRateLimit(key: string, windowMs: number, max: number) {
  const now = Date.now();
  let record = memoryCache.get(key);
  if (!record || record.expires < now) {
    record = { count: 0, expires: now + windowMs };
  }
  record.count++;
  memoryCache.set(key, record);
  return {
    success: record.count <= max,
    remaining: Math.max(0, max - record.count),
  };
}

export async function rateLimit(opts: { key: string; windowMs: number; max: number }): Promise<{ success: boolean; remaining: number; reset?: number }> {
  const hasRedis = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!hasRedis) {
    console.warn("[rateLimit] UPSTASH_REDIS_REST_URL no configurado, usando fallback en memoria para " + opts.key);
    return getMemoryRateLimit(opts.key, opts.windowMs, opts.max);
  }

  // Config is per window, so we cache ratelimiter instances by their config
  const configKey = `${opts.windowMs}_${opts.max}`;
  let limiter = ratelimitCache.get(configKey);
  
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(opts.max, `${opts.windowMs} ms`),
      analytics: true,
    });
    ratelimitCache.set(configKey, limiter);
  }

  const result = await limiter.limit(opts.key);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

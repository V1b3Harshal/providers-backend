// Advanced rate limiting with sliding window implementation
import { getRedisClient, RedisKeys } from '../config/redis';
import { logger } from './logger';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (request: any, key: string) => void;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

class SlidingWindowRateLimiter {
  private config: Required<RateLimitConfig>;
  private redisClient: any = null;

  constructor(userConfig: Partial<RateLimitConfig>) {
    this.config = {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      keyGenerator: (request) => {
        // Default key generator based on IP
        return request.ip || request.headers['x-forwarded-for'] || 'unknown';
      },
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      onLimitReached: (request, key) => {
        logger.warn('Rate limit exceeded', { key, ip: request.ip });
      },
      ...userConfig
    };
  }

  private async ensureRedisClient(): Promise<any> {
    if (this.redisClient) {
      return this.redisClient;
    }

    try {
      this.redisClient = await getRedisClient();
      return this.redisClient;
    } catch (error) {
      logger.warn('Redis not available for rate limiting, using in-memory fallback');
      return null;
    }
  }

  async checkLimit(request: any): Promise<RateLimitResult> {
    const client = await this.ensureRedisClient();
    const key = this.config.keyGenerator(request);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    if (!client) {
      // In-memory fallback (not recommended for production)
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
        totalHits: 0
      };
    }

    try {
      // Remove old entries
      await client.zRemRangeByScore(`${RedisKeys.rateLimit}:${key}`, 0, windowStart);
      
      // Get current count
      const currentCount = await client.zCard(`${RedisKeys.rateLimit}:${key}`);
      const remaining = Math.max(0, this.config.maxRequests - currentCount);
      
      if (currentCount >= this.config.maxRequests) {
        // Rate limit exceeded
        this.config.onLimitReached(request, key);
        return {
          allowed: false,
          remaining: 0,
          resetTime: now + this.config.windowMs,
          totalHits: currentCount
        };
      }

      // Add current request
      await client.zAdd(`${RedisKeys.rateLimit}:${key}`, [
        { score: now, value: now.toString() }
      ]);
      
      await client.expire(`${RedisKeys.rateLimit}:${key}`, Math.ceil(this.config.windowMs / 1000));

      return {
        allowed: true,
        remaining,
        resetTime: now + this.config.windowMs,
        totalHits: currentCount + 1
      };
    } catch (error) {
      logger.error('Rate limiting check failed:', error);
      // Fail open in case of errors
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
        totalHits: 0
      };
    }
  }

  // Middleware factory for Fastify
  middleware() {
    return async (request: any, reply: any, done: Function) => {
      try {
        const result = await this.checkLimit(request);
        
        // Add rate limit headers
        reply.header('X-RateLimit-Limit', this.config.maxRequests);
        reply.header('X-RateLimit-Remaining', result.remaining);
        reply.header('X-RateLimit-Reset', Math.floor(result.resetTime / 1000));
        reply.header('X-RateLimit-Total', result.totalHits);

        if (!result.allowed) {
          reply.code(429).send({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
              details: {
                resetTime: new Date(result.resetTime).toISOString(),
                remaining: result.remaining,
                limit: this.config.maxRequests
              }
            },
            timestamp: new Date().toISOString()
          });
          return;
        }

        done();
      } catch (error) {
        logger.error('Rate limit middleware error:', error);
        // Continue on error
        done();
      }
    };
  }

  // Reset rate limit for a specific key (useful for testing or admin operations)
  async resetLimit(request: any): Promise<void> {
    const client = await this.ensureRedisClient();
    if (client) {
      const key = this.config.keyGenerator(request);
      await client.del(`${RedisKeys.rateLimit}:${key}`);
    }
  }
}

// Pre-configured rate limiters for different use cases
export const defaultRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100
});

export const strictRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 10
});

export const internalRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 1000,
  keyGenerator: (request) => {
    // Use API key for internal requests
    return request.headers['x-internal-key'] || request.ip || 'unknown';
  }
});

// Rate limit configuration based on user type
export const createUserRateLimiter = (userType: 'public' | 'internal' | 'admin') => {
  const configs = {
    public: { windowMs: 60000, maxRequests: 100 },
    internal: { windowMs: 60000, maxRequests: 1000 },
    admin: { windowMs: 60000, maxRequests: 10000 }
  };
  
  return new SlidingWindowRateLimiter(configs[userType]);
};

export default SlidingWindowRateLimiter;
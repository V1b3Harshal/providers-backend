import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

interface UserRateLimitConfig {
  maxRequests: number;      // Max requests per user per window
  windowMs: number;         // Time window in milliseconds
  blockDurationMs: number;  // How long to block after exceeding limit
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  blockedUntil?: number;
  isBlocked: boolean;
}

class UserRateLimitService {
  private static instance: UserRateLimitService;
  private config: UserRateLimitConfig;
  private redisClient: any = null;

  constructor() {
    // Free-tier friendly configuration
    this.config = {
      maxRequests: 50,       // 50 requests per user per minute
      windowMs: 60000,       // 1 minute window
      blockDurationMs: 300000 // 5 minutes block after exceeding
    };
  }

  public static getInstance(): UserRateLimitService {
    if (!UserRateLimitService.instance) {
      UserRateLimitService.instance = new UserRateLimitService();
    }
    return UserRateLimitService.instance;
  }

  /**
   * Check if user request is allowed
   */
  async checkUserLimit(userId: string, _endpoint?: string): Promise<RateLimitResult> {
    try {
      const client = await this.getRedisClient();
      if (!client) {
        // Fallback to allow if Redis not available
        return { allowed: true, remaining: 50, resetTime: Date.now() + 60000, isBlocked: false };
      }

      const now = Date.now();
      const windowKey = this.getWindowKey(userId, now);
      const blockKey = this.getBlockKey(userId);

      // Check if user is currently blocked
      const blockUntil = await client.get(blockKey);
      if (blockUntil && now < parseInt(blockUntil)) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: parseInt(blockUntil),
          blockedUntil: parseInt(blockUntil),
          isBlocked: true
        };
      }

      // Clean up expired blocks
      if (blockUntil) {
        await client.del(blockKey);
      }

      // Get current request count for this window
      const currentCount = await this.getCurrentCount(client, windowKey);

      if (currentCount >= this.config.maxRequests) {
        // User exceeded limit - block them
        const blockedUntil = now + this.config.blockDurationMs;
        await client.set(blockKey, blockedUntil.toString());
        await client.expire(blockKey, Math.ceil(this.config.blockDurationMs / 1000));

        logger.warn(`User ${userId} exceeded rate limit, blocked until ${new Date(blockedUntil).toISOString()}`);

        return {
          allowed: false,
          remaining: 0,
          resetTime: now + this.config.windowMs,
          blockedUntil,
          isBlocked: true
        };
      }

      // Allow request and increment counter
      await this.incrementCount(client, windowKey, now);

      const remaining = Math.max(0, this.config.maxRequests - (currentCount + 1));

      return {
        allowed: true,
        remaining,
        resetTime: now + this.config.windowMs,
        isBlocked: false
      };

    } catch (error) {
      logger.error('User rate limit check failed:', error);
      // Allow request on error to avoid blocking legitimate users
      return { allowed: true, remaining: 50, resetTime: Date.now() + 60000, isBlocked: false };
    }
  }

  /**
   * Get user rate limit statistics
   */
  async getUserStats(userId: string): Promise<{
    currentWindow: { requests: number; resetTime: number };
    isBlocked: boolean;
    blockedUntil?: number | undefined;
  }> {
    try {
      const client = await this.getRedisClient();
      if (!client) {
        return {
          currentWindow: { requests: 0, resetTime: Date.now() + 60000 },
          isBlocked: false
        };
      }

      const now = Date.now();
      const windowKey = this.getWindowKey(userId, now);
      const blockKey = this.getBlockKey(userId);

      const [currentCount, blockUntil] = await Promise.all([
        this.getCurrentCount(client, windowKey),
        client.get(blockKey)
      ]);

      const isBlocked = blockUntil && now < parseInt(blockUntil);

      return {
        currentWindow: {
          requests: currentCount,
          resetTime: now + this.config.windowMs
        },
        isBlocked: !!isBlocked,
        blockedUntil: blockUntil ? parseInt(blockUntil) : undefined
      };

    } catch (error) {
      logger.error('Failed to get user rate limit stats:', error);
      return {
        currentWindow: { requests: 0, resetTime: Date.now() + 60000 },
        isBlocked: false
      };
    }
  }

  /**
   * Reset user rate limit (admin function)
   */
  async resetUserLimit(userId: string): Promise<boolean> {
    try {
      const client = await this.getRedisClient();
      if (!client) return false;

      const now = Date.now();
      const windowKey = this.getWindowKey(userId, now);
      const blockKey = this.getBlockKey(userId);

      await Promise.all([
        client.del(windowKey),
        client.del(blockKey)
      ]);

      logger.info(`Reset rate limit for user: ${userId}`);
      return true;

    } catch (error) {
      logger.error('Failed to reset user rate limit:', error);
      return false;
    }
  }

  /**
   * Get overall rate limiting statistics
   */
  async getGlobalStats(): Promise<{
    totalUsers: number;
    blockedUsers: number;
    activeWindows: number;
  }> {
    try {
      const client = await this.getRedisClient();
      if (!client) {
        return { totalUsers: 0, blockedUsers: 0, activeWindows: 0 };
      }

      // Upstash Redis doesn't support KEYS command, so we return estimated stats
      // In a real implementation, you'd maintain counters separately
      logger.info('Global rate limit stats not available with Upstash Redis (KEYS command not supported)');
      return { totalUsers: 0, blockedUsers: 0, activeWindows: 0 };

    } catch (error) {
      logger.error('Failed to get global rate limit stats:', error);
      return { totalUsers: 0, blockedUsers: 0, activeWindows: 0 };
    }
  }

  private async getRedisClient(): Promise<any> {
    if (!this.redisClient) {
      try {
        this.redisClient = await getRedisClient();
      } catch (error) {
        logger.warn('Redis not available for user rate limiting');
        return null;
      }
    }
    return this.redisClient;
  }

  private getWindowKey(userId: string, timestamp: number): string {
    // Create sliding window key based on current minute
    const windowStart = Math.floor(timestamp / this.config.windowMs) * this.config.windowMs;
    return `ratelimit:user:${userId}:${windowStart}`;
  }

  private getBlockKey(userId: string): string {
    return `ratelimit:block:${userId}`;
  }

  private async getCurrentCount(client: any, windowKey: string): Promise<number> {
    try {
      const count = await client.zCard(windowKey);
      return count || 0;
    } catch (error) {
      logger.warn('Failed to get current count:', error);
      return 0;
    }
  }

  private async incrementCount(client: any, windowKey: string, timestamp: number): Promise<void> {
    try {
      // Add current timestamp to sorted set
      await client.zAdd(windowKey, [{ score: timestamp, value: timestamp.toString() }]);

      // Set expiry on the key (add some buffer)
      const expirySeconds = Math.ceil((this.config.windowMs * 2) / 1000);
      await client.expire(windowKey, expirySeconds);

    } catch (error) {
      logger.warn('Failed to increment count:', error);
    }
  }
}

export const userRateLimitService = UserRateLimitService.getInstance();
export default userRateLimitService;
import { createSafeErrorResponse, logErrorWithDetails, ValidationError, NotFoundError, ProviderError, ExternalServiceError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { getRedisClient, RedisKeys } from '../config/redis';
import { TMDB_API_KEY, TMDB_API_URL, VIDNEST_BASE_URL } from '../config/environment';

export interface ProviderEmbedData {
  provider: string;
  embedUrl: string;
  iframeCode: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  iframeTemplate: string;
  healthCheckUrl?: string;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export class ProviderService {
  private providers: Map<string, ProviderConfig> = new Map();
  private redisClient: any;

  constructor() {
    // Initialize providers first
    this.initializeProviders();
    // Get Redis client if available, otherwise null
    try {
      this.redisClient = getRedisClient();
    } catch (error) {
      console.warn('Redis client not available, rate limiting will be disabled');
      this.redisClient = null;
    }
  }

  private initializeProviders() {
    // Initialize with vidnest provider only
    this.providers.set('vidnest', {
      id: 'vidnest',
      name: 'Vidnest',
      baseUrl: VIDNEST_BASE_URL,
      enabled: true,
      iframeTemplate: '<iframe src="{embedUrl}" frameBorder="0" scrolling="no" allowFullScreen></iframe>',
      healthCheckUrl: VIDNEST_BASE_URL,
      rateLimit: {
        requests: 100,
        windowMs: 60000 // 1 minute
      },
    });

    logger.info('Provider service initialized with vidnest provider');
  }

  async getProviderEmbedUrl(provider: string, mediaId: string, mediaType: 'movie' | 'tv' = 'movie', season?: number, episode?: number): Promise<ProviderEmbedData> {
    try {
      const providerConfig = this.providers.get(provider);
      if (!providerConfig) {
        throw new NotFoundError(`Provider ${provider} not found`);
      }

      if (!providerConfig.enabled) {
        throw new ProviderError(`Provider ${provider} is disabled`, provider);
      }

      // Validate mediaId
      if (!mediaId || mediaId.trim() === '') {
        throw new ValidationError('Media ID is required');
      }

      let embedUrl: string;

      if (mediaType === 'movie') {
        embedUrl = `${providerConfig.baseUrl}/movie/${mediaId}`;
      } else if (mediaType === 'tv') {
        if (!season || !episode) {
          throw new ValidationError('Season and episode are required for TV shows');
        }
        if (season < 1 || episode < 1) {
          throw new ValidationError('Season and episode must be positive numbers');
        }
        embedUrl = `${providerConfig.baseUrl}/tv/${mediaId}/${season}/${episode}`;
      } else {
        throw new ValidationError(`Invalid media type: ${mediaType}. Must be 'movie' or 'tv'`);
      }

      const iframeCode = providerConfig.iframeTemplate.replace('{embedUrl}', embedUrl);

      return {
        provider: providerConfig.id,
        embedUrl,
        iframeCode
      };
    } catch (error) {
      logErrorWithDetails(error, {
        context: 'Get provider embed URL',
        provider,
        mediaId,
        mediaType,
        season,
        episode
      });
      throw error;
    }
  }

  async getSupportedProviders(): Promise<ProviderConfig[]> {
    return Array.from(this.providers.values()).filter(provider => provider.enabled);
  }


  async getProviderStats(): Promise<{
    totalProviders: number;
    enabledProviders: number;
    disabledProviders: number;
    providers: ProviderConfig[];
  }> {
    const allProviders = Array.from(this.providers.values());
    const enabledProviders = allProviders.filter(p => p.enabled);
    const disabledProviders = allProviders.filter(p => !p.enabled);

    return {
      totalProviders: allProviders.length,
      enabledProviders: enabledProviders.length,
      disabledProviders: disabledProviders.length,
      providers: allProviders
    };
  }

  // Rate limiting using Redis
  async checkRateLimit(provider: string, userId: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      // If Redis is not available, allow all requests
      if (!this.redisClient) {
        return { allowed: true, remaining: 100, resetTime: Date.now() + 60000 };
      }

      const providerConfig = this.providers.get(provider);
      if (!providerConfig || !providerConfig.rateLimit) {
        return { allowed: true, remaining: 100, resetTime: Date.now() + 60000 };
      }

      const { requests, windowMs } = providerConfig.rateLimit;
      const key = `${RedisKeys.rateLimit}:${provider}:${userId}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove old requests
      await this.redisClient.zRemRangeByScore(key, 0, windowStart);

      // Add current request
      await this.redisClient.zAdd(key, [{ score: now, value: now.toString() }]);
      await this.redisClient.expire(key, Math.ceil(windowMs / 1000));

      // Get current count
      const currentCount = await this.redisClient.zCard(key);
      const remaining = Math.max(0, requests - currentCount);

      return {
        allowed: currentCount <= requests,
        remaining,
        resetTime: now + windowMs
      };
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      // Fallback to allow if Redis fails
      return { allowed: true, remaining: 100, resetTime: Date.now() + 60000 };
    }
  }


  async incrementRateLimit(provider: string, userId: string): Promise<void> {
    try {
      // If Redis is not available, do nothing
      if (!this.redisClient) {
        return;
      }

      const providerConfig = this.providers.get(provider);
      if (!providerConfig || !providerConfig.rateLimit) {
        return;
      }

      const { windowMs } = providerConfig.rateLimit;
      const key = `${RedisKeys.rateLimit}:${provider}:${userId}`;
      const now = Date.now();

      await this.redisClient.zAdd(key, [{ score: now, value: now.toString() }]);
      await this.redisClient.expire(key, Math.ceil(windowMs / 1000));
    } catch (error) {
      logger.error('Rate limit increment failed:', error);
    }
  }
}

export const providerService = new ProviderService();
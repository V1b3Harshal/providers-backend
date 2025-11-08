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
  private redisClient: any = null;
  private redisInitialized = false;
  private initializingPromise: Promise<void> | null = null;

  constructor() {
    // Initialize providers first
    this.initializeProviders();
  }

  private async ensureRedisClient(): Promise<any> {
    // If already initialized, return the client
    if (this.redisInitialized) {
      return this.redisClient;
    }

    // If currently initializing, wait for it to complete
    if (this.initializingPromise) {
      try {
        await this.initializingPromise;
      } catch (error) {
        logger.warn('Redis initialization failed, using in-memory fallback:', error);
        this.redisClient = null;
        this.redisInitialized = true;
      }
      return this.redisClient;
    }

    // Start initialization with a timeout
    this.initializingPromise = new Promise<void>(async (resolve) => {
      try {
        // Set a timeout to avoid hanging
        const timeoutId = setTimeout(() => {
          logger.warn('Redis initialization timeout, using in-memory fallback');
          this.redisClient = null;
          this.redisInitialized = true;
          resolve();
        }, 5000); // 5 second timeout

        // Try to initialize Redis
        this.redisClient = await this.initializeRedisInternal();
        clearTimeout(timeoutId);
        this.redisInitialized = true;
        resolve();
      } catch (error) {
        logger.warn('Redis initialization failed, using in-memory fallback:', error);
        this.redisClient = null;
        this.redisInitialized = true;
        resolve();
      }
    });
    
    try {
      await this.initializingPromise;
    } finally {
      this.initializingPromise = null;
    }
    
    return this.redisClient;
  }

  private async initializeRedisInternal(): Promise<void> {
    try {
      this.redisClient = await getRedisClient();
      this.redisInitialized = true;
      logger.info('Redis client initialized for provider service');
    } catch (error) {
      logger.warn('Redis client not available, rate limiting will be disabled');
      this.redisClient = null;
      this.redisInitialized = true; // Mark as initialized even if failed
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
    try {
      const providers = Array.from(this.providers.values()).filter(provider => provider.enabled);
      logger.info(`getSupportedProviders: returning ${providers.length} providers`);
      return providers;
    } catch (error) {
      logger.error('Error in getSupportedProviders:', error);
      throw error;
    }
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
      // Ensure Redis client is ready
      const client = await this.ensureRedisClient();
      
      // If Redis is not available, allow all requests
      if (!client) {
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
      await client.zRemRangeByScore(key, 0, windowStart);

      // Add current request
      await client.zAdd(key, [{ score: now, value: now.toString() }]);
      await client.expire(key, Math.ceil(windowMs / 1000));

      // Get current count
      const currentCount = await client.zCard(key);
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
      // Ensure Redis client is ready
      const client = await this.ensureRedisClient();
      
      // If Redis is not available, do nothing
      if (!client) {
        return;
      }

      const providerConfig = this.providers.get(provider);
      if (!providerConfig || !providerConfig.rateLimit) {
        return;
      }

      const { windowMs } = providerConfig.rateLimit;
      const key = `${RedisKeys.rateLimit}:${provider}:${userId}`;
      const now = Date.now();

      await client.zAdd(key, [{ score: now, value: now.toString() }]);
      await client.expire(key, Math.ceil(windowMs / 1000));
    } catch (error) {
      logger.error('Rate limit increment failed:', error);
    }
  }
}

export const providerService = new ProviderService();
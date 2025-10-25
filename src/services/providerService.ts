import axios from 'axios';
import { Provider, ProviderEmbedUrl, ProviderHealthStatus } from '../types';
import { getProviderCache, setProviderCache } from '../config/redis';
import { RedisKeys } from '../config/redis';

export class ProviderService {
  private providers: Provider[] = [
    {
      id: 'vidnest',
      name: 'VidNest',
      baseUrl: 'https://vidnest.fun',
      iframeTemplate: '<iframe src="https://vidnest.fun/movie/{id}" frameBorder="0" scrolling="no" allowFullScreen></iframe>',
      enabled: true,
      healthCheckUrl: 'https://vidnest.fun',
      rateLimit: { requests: 10, windowMs: 60000 },
      proxyRequired: true
    },
    {
      id: 'vidsrc',
      name: 'VidSrc',
      baseUrl: 'https://vidsrc.to',
      iframeTemplate: '<iframe src="https://vidsrc.to/embed-{id}" frameBorder="0" scrolling="no" allowFullScreen></iframe>',
      enabled: true,
      healthCheckUrl: 'https://vidsrc.to',
      rateLimit: { requests: 15, windowMs: 60000 },
      proxyRequired: true
    },
    {
      id: 'embed',
      name: 'EmbedStream',
      baseUrl: 'https://embed.stream',
      iframeTemplate: '<iframe src="https://embed.stream/embed/{id}" frameBorder="0" scrolling="no" allowFullScreen></iframe>',
      enabled: true,
      healthCheckUrl: 'https://embed.stream',
      rateLimit: { requests: 20, windowMs: 60000 },
      proxyRequired: false
    }
  ];

  async getProviderEmbedUrl(providerId: string, mediaId: string): Promise<ProviderEmbedUrl> {
    // Check cache first
    const cacheKey = `${providerId}:${mediaId}`;
    const cached = await getProviderCache('embed', cacheKey);
    if (cached) {
      return cached;
    }

    const provider = this.providers.find(p => p.id === providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    if (!provider.enabled) {
      throw new Error(`Provider ${providerId} is disabled`);
    }

    // Generate embed URL and iframe code
    const embedUrl = `${provider.baseUrl}/movie/${mediaId}`;
    const iframeCode = provider.iframeTemplate.replace('{id}', mediaId);

    const result: ProviderEmbedUrl = {
      provider: providerId,
      embedUrl,
      iframeCode,
      success: true
    };

    // Cache the result for 6 hours
    await setProviderCache('embed', cacheKey, result, 21600);

    return result;
  }

  async getSupportedProviders(): Promise<Provider[]> {
    return this.providers.filter(p => p.enabled);
  }

  async checkProviderHealth(providerId: string): Promise<ProviderHealthStatus> {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const startTime = Date.now();
    let status: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
    let responseTime: number | undefined;
    let error: string | undefined;

    try {
      if (!provider.healthCheckUrl) {
        throw new Error('No health check URL configured');
      }

      const response = await axios.get(provider.healthCheckUrl, {
        timeout: 10000,
        validateStatus: (status: number) => status < 500
      });

      responseTime = Date.now() - startTime;
      
      if (response.status >= 200 && response.status < 300) {
        status = 'healthy';
      } else {
        status = 'unhealthy';
        error = `HTTP ${response.status}`;
      }
    } catch (err) {
      responseTime = Date.now() - startTime;
      status = 'unhealthy';
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const healthStatus: ProviderHealthStatus = {
      provider: providerId,
      status,
      lastChecked: new Date(),
      responseTime,
      error: error || undefined
    } as ProviderHealthStatus;

    // Cache health status for 5 minutes
    await setProviderCache('health', providerId, healthStatus, 300);

    return healthStatus;
  }

  async checkAllProvidersHealth(): Promise<ProviderHealthStatus[]> {
    const healthChecks = this.providers.map(provider => 
      this.checkProviderHealth(provider.id)
    );
    return Promise.all(healthChecks);
  }

  async getProviderStatus(providerId: string): Promise<ProviderHealthStatus> {
    // Check cache first
    const cached = await getProviderCache('health', providerId);
    if (cached) {
      return cached;
    }

    return this.checkProviderHealth(providerId);
  }

  async getProviderStats(): Promise<any> {
    const stats = {
      totalProviders: this.providers.length,
      enabledProviders: this.providers.filter(p => p.enabled).length,
      disabledProviders: this.providers.filter(p => !p.enabled).length,
      providersRequiringProxy: this.providers.filter(p => p.proxyRequired).length,
      providers: this.providers.map(p => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        proxyRequired: p.proxyRequired,
        rateLimit: p.rateLimit
      }))
    };

    return stats;
  }
}

export const providerService = new ProviderService();
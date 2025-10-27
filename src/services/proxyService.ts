import axios from 'axios';
import { ProxyConfig, ProxyHealthStatus } from '../types';
import { getProxyHealth, setProxyHealth, getRedisClient, RedisKeys } from '../config/redis';

export class ProxyService {
  private proxies: ProxyConfig[] = [];
  private currentIndex: number = 0;
  private rotationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeProxies();
  }

  private initializeProxies() {
    // Load proxies from environment only - no default proxies
    const proxyUrls = process.env.PROXY_URLS?.split(',').filter(url => url.trim() !== '') || [];

    if (proxyUrls.length === 0) {
      console.log('No proxies provided in PROXY_URLS environment variable - proxy rotation disabled');
      this.proxies = [];
      return;
    }

    console.log(`Initializing ${proxyUrls.length} proxies from environment`);
    this.proxies = proxyUrls.map((url, index) => ({
      url: url.trim(),
      enabled: true,
      lastUsed: new Date(Date.now() - index * 60000), // Stagger last used times
      requestCount: 0,
      successRate: 100,
      healthCheckUrl: `${url.trim()}/health`
    }));

    // Start proxy rotation
    this.startProxyRotation();
  }

  async getProxy(): Promise<ProxyConfig | null> {
    // If no proxies are configured, return null
    if (this.proxies.length === 0) {
      console.log('No proxies configured - returning null');
      return null;
    }

    // Find next available proxy
    const availableProxies = this.proxies.filter(p => p.enabled);
    if (availableProxies.length === 0) {
      return null;
    }

    // Use round-robin selection
    const proxy = availableProxies[this.currentIndex % availableProxies.length];
    this.currentIndex++;

    // Update last used time
    if (proxy) {
      proxy.lastUsed = new Date();
      proxy.requestCount++;
    }

    return proxy || null;
  }

  async checkProxyHealth(proxyUrl: string): Promise<ProxyHealthStatus> {
    const startTime = Date.now();
    let status: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
    let responseTime: number | undefined;
    let error: string | undefined;

    try {
      const proxy = this.proxies.find(p => p.url === proxyUrl);
      if (!proxy) {
        throw new Error('Proxy not found');
      }

      const healthCheckUrl = proxy.healthCheckUrl || proxyUrl;
      
      const response = await axios.get(healthCheckUrl, {
        timeout: 10000,
        proxy: {
          host: new URL(proxyUrl).hostname,
          port: parseInt(new URL(proxyUrl).port) || 8080
        },
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

    const healthStatus: ProxyHealthStatus = {
      proxyUrl,
      status,
      lastChecked: new Date(),
      responseTime,
      error: error || undefined,
      successRate: status === 'healthy' ? 100 : 0
    } as ProxyHealthStatus;

    // Cache health status for 5 minutes
    await setProxyHealth(proxyUrl, status === 'healthy');

    return healthStatus;
  }

  async checkAllProxiesHealth(): Promise<ProxyHealthStatus[]> {
    const healthChecks = this.proxies.map(proxy => 
      this.checkProxyHealth(proxy.url)
    );
    return Promise.all(healthChecks);
  }

  async disableProxy(proxyUrl: string): Promise<void> {
    const proxy = this.proxies.find(p => p.url === proxyUrl);
    if (proxy) {
      proxy.enabled = false;
      console.log(`Proxy ${proxyUrl} disabled`);
    }
  }

  async enableProxy(proxyUrl: string): Promise<void> {
    const proxy = this.proxies.find(p => p.url === proxyUrl);
    if (proxy) {
      proxy.enabled = true;
      console.log(`Proxy ${proxyUrl} enabled`);
    }
  }

  async getProxyStats(): Promise<any> {
    const totalProxies = this.proxies.length;
    const enabledProxies = this.proxies.filter(p => p.enabled).length;
    const disabledProxies = totalProxies - enabledProxies;

    const avgSuccessRate = this.proxies.reduce((sum, p) => sum + p.successRate, 0) / totalProxies;

    return {
      totalProxies,
      enabledProxies,
      disabledProxies,
      averageSuccessRate: Math.round(avgSuccessRate * 100) / 100,
      proxies: this.proxies.map(p => ({
        url: p.url,
        enabled: p.enabled,
        lastUsed: p.lastUsed,
        requestCount: p.requestCount,
        successRate: p.successRate
      }))
    };
  }

  private startProxyRotation(): void {
    // Only start proxy rotation if proxies are configured
    if (this.proxies.length === 0) {
      console.log('No proxies configured - skipping proxy rotation setup');
      return;
    }

    const rotationInterval = parseInt(process.env.PROXY_ROTATION_INTERVAL || '300000'); // 5 minutes
    
    this.rotationInterval = setInterval(async () => {
      console.log('Performing proxy health check...');
      const healthStatuses = await this.checkAllProxiesHealth();
      
      healthStatuses.forEach(status => {
        if (status.status === 'unhealthy') {
          console.warn(`Proxy ${status.proxyUrl} is unhealthy: ${status.error}`);
          this.disableProxy(status.proxyUrl);
        }
      });

      // Try to re-enable some proxies if we have too many disabled
      const disabledProxies = this.proxies.filter(p => !p.enabled);
      if (disabledProxies.length > 0) {
        console.log(`Re-checking ${disabledProxies.length} disabled proxies...`);
        disabledProxies.forEach(proxy => {
          this.enableProxy(proxy.url);
        });
      }
    }, rotationInterval);
  }

  async addProxy(proxyUrl: string): Promise<void> {
    if (this.proxies.some(p => p.url === proxyUrl)) {
      throw new Error('Proxy already exists');
    }

    this.proxies.push({
      url: proxyUrl,
      enabled: true,
      lastUsed: new Date(),
      requestCount: 0,
      successRate: 100,
      healthCheckUrl: `${proxyUrl}/health`
    });

    console.log(`Added new proxy: ${proxyUrl}`);
  }

  async removeProxy(proxyUrl: string): Promise<void> {
    const index = this.proxies.findIndex(p => p.url === proxyUrl);
    if (index === -1) {
      throw new Error('Proxy not found');
    }

    this.proxies.splice(index, 1);
    console.log(`Removed proxy: ${proxyUrl}`);
  }

  async cleanup(): Promise<void> {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
    }
  }
}

export const proxyService = new ProxyService();
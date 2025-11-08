// Health check and monitoring utilities
import { logger } from './logger';
import { getRedisClient } from '../config/redis';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'ok' | 'error' | 'warning';
      message?: string;
      responseTime?: number;
      details?: any;
    };
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  version: string;
}

export interface ServiceHealth {
  name: string;
  url: string;
  timeout: number;
  critical: boolean;
}

class HealthMonitor {
  private startTime = Date.now();
  private checks = new Map<string, { lastCheck: number; status: 'ok' | 'error' | 'warning'; message?: string }>();

  constructor(private version: string = '1.0.0') {}

  async performHealthCheck(services: ServiceHealth[] = []): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};
    const overallStatus: Array<'healthy' | 'unhealthy' | 'degraded'> = ['healthy'];

    // Redis health check
    try {
      const redisStart = Date.now();
      const client = await getRedisClient();
      if (client) {
        // Use a simple operation instead of ping since our mock doesn't have it
        await client.get('health_check');
        checks.redis = { 
          status: 'ok', 
          responseTime: Date.now() - redisStart,
          message: 'Redis connection successful' 
        };
      } else {
        checks.redis = { 
          status: 'warning', 
          message: 'Using in-memory fallback' 
        };
        overallStatus.push('degraded');
      }
    } catch (error) {
      checks.redis = { 
        status: 'error', 
        message: 'Redis connection failed',
        details: error instanceof Error ? error.message : String(error)
      };
      overallStatus.push('unhealthy');
    }

    // External services health checks
    for (const service of services) {
      try {
        const serviceStart = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), service.timeout);

        const response = await fetch(service.url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'ProvidersBackend-HealthCheck/1.0'
          }
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - serviceStart;

        if (response.ok) {
          checks[service.name] = {
            status: 'ok',
            responseTime,
            message: `Service responding (${response.status})`
          };
        } else {
          const status = service.critical ? 'error' : 'warning';
          checks[service.name] = {
            status,
            responseTime,
            message: `Service error (${response.status})`
          };
          overallStatus.push(service.critical ? 'unhealthy' : 'degraded');
        }
      } catch (error) {
        const status = service.critical ? 'error' : 'warning';
        checks[service.name] = {
          status,
          message: 'Service unreachable',
          details: error instanceof Error ? error.message : String(error)
        };
        overallStatus.push(service.critical ? 'unhealthy' : 'degraded');
      }
    }

    // Memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    if (memoryPercentage > 90) {
      overallStatus.push('unhealthy');
    } else if (memoryPercentage > 75) {
      overallStatus.push('degraded');
    }

    // Determine overall status
    let finalStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (overallStatus.includes('unhealthy')) {
      finalStatus = 'unhealthy';
    } else if (overallStatus.includes('degraded')) {
      finalStatus = 'degraded';
    }

    return {
      status: finalStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks,
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: memoryPercentage
      },
      version: this.version
    };
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  getStatus(): { healthy: boolean; uptime: number } {
    return {
      healthy: true,
      uptime: this.getUptime()
    };
  }
}

// Create global health monitor instance
export const healthMonitor = new HealthMonitor();

// Health check middleware for routes
export const healthCheckMiddleware = (services: ServiceHealth[] = []) => {
  return async (request: any, reply: any) => {
    try {
      const result = await healthMonitor.performHealthCheck(services);
      
      const statusCode = result.status === 'healthy' ? 200 : 
                        result.status === 'degraded' ? 200 : 503;
      
      reply.code(statusCode).send(result);
    } catch (error) {
      logger.error('Health check failed:', error);
      reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check system failure',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };
};

// Metrics collection
export class MetricsCollector {
  private metrics = new Map<string, number>();

  increment(name: string, value: number = 1): void {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }

  record(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  get(name: string): number {
    return this.metrics.get(name) || 0;
  }

  getAll(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  reset(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

// Global metrics collector
export const metrics = new MetricsCollector();
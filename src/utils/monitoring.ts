// Real-time monitoring and alerting system
import { logger } from './logger';
import { metrics, HealthCheckResult } from './healthCheck';

export interface MonitoringConfig {
  alertThresholds: {
    errorRate: number;        // Maximum acceptable error rate (%)
    responseTime: number;     // Maximum average response time (ms)
    memoryUsage: number;      // Maximum memory usage (%)
    diskUsage: number;        // Maximum disk usage (%)
  };
  checkInterval: number;      // Health check interval (ms)
  alertChannels: string[];    // Alert notification channels
}

class MonitoringService {
  private config: MonitoringConfig;
  private isMonitoring = false;
  private alertHistory: Map<string, { timestamp: number; count: number }> = new Map();

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      alertThresholds: {
        errorRate: 5,          // 5% error rate
        responseTime: 1000,    // 1 second response time
        memoryUsage: 80,       // 80% memory usage
        diskUsage: 90,         // 90% disk usage
      },
      checkInterval: 30000,    // 30 seconds
      alertChannels: ['log'],  // Log to console by default
      ...config
    };
  }

  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting monitoring service');

    // Perform initial health check
    this.performHealthCheck();

    // Set up periodic health checks
    setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);

    // Set up metrics collection
    this.setupMetricsCollection();
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    logger.info('Monitoring service stopped');
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Check system metrics
      const systemMetrics = this.getSystemMetrics();
      const appMetrics = this.getApplicationMetrics();
      
      // Check thresholds and trigger alerts if needed
      await this.checkThresholds(systemMetrics, appMetrics);
      
      // Log metrics
      this.logMetrics(systemMetrics, appMetrics);
      
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  private getSystemMetrics(): {
    memory: { used: number; total: number; percentage: number };
    cpu: { usage: number };
    uptime: number;
  } {
    const memoryUsage = process.memoryUsage();
    const usedMemory = memoryUsage.heapUsed;
    const totalMemory = memoryUsage.heapTotal;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    return {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: memoryPercentage
      },
      cpu: {
        usage: process.cpuUsage().user // Simplified CPU usage
      },
      uptime: process.uptime()
    };
  }

  private getApplicationMetrics(): {
    requests: { total: number; errors: number; success: number };
    responseTime: { average: number; p95: number; p99: number };
    activeConnections: number;
  } {
    return {
      requests: {
        total: metrics.get('requests_total'),
        errors: metrics.get('requests_errors'),
        success: metrics.get('requests_success')
      },
      responseTime: {
        average: metrics.get('response_time_avg'),
        p95: metrics.get('response_time_p95'),
        p99: metrics.get('response_time_p99')
      },
      activeConnections: metrics.get('active_connections')
    };
  }

  private async checkThresholds(systemMetrics: any, appMetrics: any): Promise<void> {
    const alerts: string[] = [];

    // Error rate check
    const errorRate = appMetrics.requests.total > 0 
      ? (appMetrics.requests.errors / appMetrics.requests.total) * 100 
      : 0;
    
    if (errorRate > this.config.alertThresholds.errorRate) {
      alerts.push(`High error rate: ${errorRate.toFixed(2)}% (threshold: ${this.config.alertThresholds.errorRate}%)`);
    }

    // Response time check
    if (appMetrics.responseTime.average > this.config.alertThresholds.responseTime) {
      alerts.push(`High response time: ${appMetrics.responseTime.average}ms (threshold: ${this.config.alertThresholds.responseTime}ms)`);
    }

    // Memory usage check
    if (systemMetrics.memory.percentage > this.config.alertThresholds.memoryUsage) {
      alerts.push(`High memory usage: ${systemMetrics.memory.percentage.toFixed(1)}% (threshold: ${this.config.alertThresholds.memoryUsage}%)`);
    }

    // Process alerts
    if (alerts.length > 0) {
      await this.triggerAlerts(alerts);
    }
  }

  private async triggerAlerts(alerts: string[]): Promise<void> {
    for (const alert of alerts) {
      // Log alert
      logger.warn('ALERT:', alert);
      
      // Track alert frequency to prevent spam
      const alertKey = alert;
      const now = Date.now();
      const history = this.alertHistory.get(alertKey);
      
      if (!history || now - history.timestamp > 300000) { // 5 minutes cooldown
        this.alertHistory.set(alertKey, { timestamp: now, count: 1 });
        
        // Send to configured channels
        for (const channel of this.config.alertChannels) {
          await this.sendAlert(channel, alert);
        }
      }
    }
  }

  private async sendAlert(channel: string, message: string): Promise<void> {
    switch (channel) {
      case 'log':
        logger.error('MONITORING ALERT:', message);
        break;
      // Add more channels as needed (email, Slack, etc.)
      default:
        logger.warn(`Unknown alert channel: ${channel}`);
    }
  }

  private logMetrics(systemMetrics: any, appMetrics: any): void {
    if (process.env.NODE_ENV === 'development') {
      logger.info('System metrics:', systemMetrics);
      logger.info('Application metrics:', appMetrics);
    }
  }

  private setupMetricsCollection(): void {
    // Set up periodic metrics collection
    setInterval(() => {
      // Calculate error rate
      const total = metrics.get('requests_total');
      const errors = metrics.get('requests_errors');
      const success = metrics.get('requests_success');
      
      // Verify totals add up
      if (total !== errors + success) {
        metrics.record('data_inconsistency', 1);
      }
    }, 60000); // Check every minute
  }

  // Public methods for external use
  recordRequest(success: boolean, responseTime: number): void {
    metrics.increment('requests_total');
    metrics.record('response_time_avg', responseTime);
    
    if (success) {
      metrics.increment('requests_success');
    } else {
      metrics.increment('requests_errors');
    }
  }

  getMetrics(): Record<string, number> {
    return metrics.getAll();
  }

  getHealthSummary(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    lastCheck: number;
  } {
    const systemMetrics = this.getSystemMetrics();
    const appMetrics = this.getApplicationMetrics();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Determine status based on metrics
    const errorRate = appMetrics.requests.total > 0 
      ? (appMetrics.requests.errors / appMetrics.requests.total) * 100 
      : 0;
      
    if (errorRate > 10 || systemMetrics.memory.percentage > 90) {
      status = 'unhealthy';
    } else if (errorRate > 5 || systemMetrics.memory.percentage > 80) {
      status = 'degraded';
    }
    
    return {
      status,
      uptime: systemMetrics.uptime,
      lastCheck: Date.now()
    };
  }
}

// Global monitoring instance
export const monitoring = new MonitoringService();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  monitoring.startMonitoring();
}

// Export for external use
export default MonitoringService;
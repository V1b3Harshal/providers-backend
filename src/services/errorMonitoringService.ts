import { logger } from '../utils/logger';
import { getRedisClient } from '../config/redis';

interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  errorRate: number; // errors per minute
  lastErrorTime: number;
  consecutiveErrors: number;
}

class ErrorMonitoringService {
  private static instance: ErrorMonitoringService;
  private metrics: ErrorMetrics;
  private alertThresholds = {
    errorRate: 10, // errors per minute
    consecutiveErrors: 5,
    timeWindow: 5 * 60 * 1000 // 5 minutes
  };
  private lastAlertTime = 0;
  private alertCooldown = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsByEndpoint: {},
      errorRate: 0,
      lastErrorTime: 0,
      consecutiveErrors: 0
    };

    // Reset metrics periodically
    setInterval(() => this.resetMetrics(), this.alertThresholds.timeWindow);
  }

  public static getInstance(): ErrorMonitoringService {
    if (!ErrorMonitoringService.instance) {
      ErrorMonitoringService.instance = new ErrorMonitoringService();
    }
    return ErrorMonitoringService.instance;
  }

  async trackError(error: any, context: any = {}) {
    const now = Date.now();
    this.metrics.totalErrors++;

    // Track error by type
    const errorType = error?.name || error?.constructor?.name || 'UnknownError';
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;

    // Track error by endpoint
    const endpoint = context?.url || context?.endpoint || 'unknown';
    this.metrics.errorsByEndpoint[endpoint] = (this.metrics.errorsByEndpoint[endpoint] || 0) + 1;

    // Calculate error rate
    const timeDiff = now - this.metrics.lastErrorTime;
    if (timeDiff > 0) {
      this.metrics.errorRate = (this.metrics.totalErrors / (timeDiff / 60000)); // errors per minute
    }

    // Track consecutive errors
    if (now - this.metrics.lastErrorTime < 60000) { // within 1 minute
      this.metrics.consecutiveErrors++;
    } else {
      this.metrics.consecutiveErrors = 1;
    }

    this.metrics.lastErrorTime = now;

    // Store error in Redis for persistence
    try {
      const redis = getRedisClient();
      const errorKey = `error:${now}`;
      const errorData = {
        timestamp: now,
        type: errorType,
        message: error?.message || 'Unknown error',
        stack: error?.stack,
        context,
        endpoint
      };

      await redis.set(errorKey, JSON.stringify(errorData));
      await redis.expire(errorKey, 24 * 60 * 60); // expire in 24 hours

      // Keep only last 100 errors
      const errorKeys = await redis.keys('error:*');
      if (errorKeys.length > 100) {
        const sortedKeys = errorKeys.sort().slice(0, errorKeys.length - 100);
        for (const key of sortedKeys) {
          await redis.del(key);
        }
      }
    } catch (redisError) {
      logger.warn('Failed to store error in Redis:', redisError);
    }

    // Check for alerts
    await this.checkAlertConditions(error, context);

    logger.error('Error tracked:', {
      type: errorType,
      message: error?.message,
      endpoint,
      totalErrors: this.metrics.totalErrors,
      errorRate: this.metrics.errorRate.toFixed(2)
    });
  }

  private async checkAlertConditions(error: any, context: any) {
    const now = Date.now();

    // Skip if we're in cooldown period
    if (now - this.lastAlertTime < this.alertCooldown) {
      return;
    }

    let shouldAlert = false;
    let alertReason = '';

    if (this.metrics.errorRate > this.alertThresholds.errorRate) {
      shouldAlert = true;
      alertReason = `High error rate: ${this.metrics.errorRate.toFixed(2)} errors/minute`;
    }

    if (this.metrics.consecutiveErrors >= this.alertThresholds.consecutiveErrors) {
      shouldAlert = true;
      alertReason = `Consecutive errors: ${this.metrics.consecutiveErrors}`;
    }

    if (shouldAlert) {
      await this.sendAlert(error, context, alertReason);
      this.lastAlertTime = now;
    }
  }

  private async sendAlert(error: any, context: any, reason: string) {
    const alertData = {
      timestamp: new Date().toISOString(),
      service: 'providers-backend',
      alertType: 'error_rate_exceeded',
      reason,
      metrics: this.metrics,
      lastError: {
        message: error?.message,
        type: error?.name,
        endpoint: context?.url || context?.endpoint,
        ip: context?.ip
      }
    };

    logger.error('🚨 ERROR ALERT:', alertData);

    // Send webhook alert if configured
    try {
      const webhookUrl = process.env.ERROR_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(alertData)
        });
      }
    } catch (webhookError) {
      logger.error('Failed to send error webhook:', webhookError);
    }

    // Could also send email alerts, Slack notifications, etc.
  }

  private resetMetrics() {
    // Keep some historical data but reset counters
    this.metrics.totalErrors = Math.floor(this.metrics.totalErrors * 0.1); // Keep 10%
    this.metrics.consecutiveErrors = 0;
    this.metrics.errorRate = 0;
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  async getRecentErrors(limit: number = 10): Promise<any[]> {
    try {
      const redis = getRedisClient();
      const errorKeys = await redis.keys('error:*');
      const sortedKeys = errorKeys.sort().reverse().slice(0, limit);

      const errors = [];
      for (const key of sortedKeys) {
        const errorData = await redis.get(key);
        if (errorData?.result) {
          errors.push(JSON.parse(errorData.result));
        }
      }

      return errors;
    } catch (error) {
      logger.error('Failed to get recent errors:', error);
      return [];
    }
  }
}

export const errorMonitoringService = ErrorMonitoringService.getInstance();
export default errorMonitoringService;
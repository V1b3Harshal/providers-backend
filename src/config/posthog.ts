// Enhanced PostHog Analytics Configuration for Providers Backend
import { logger } from '../utils/logger';

let isPostHogInitialized = false;

export const initPostHog = () => {
  if (!process.env.POSTHOG_API_KEY) {
    logger.warn('PostHog API key not configured, skipping PostHog initialization');
    return;
  }

  try {
    isPostHogInitialized = true;
    logger.info('PostHog initialized successfully (HTTP API client)');
  } catch (error) {
    logger.error('Failed to initialize PostHog:', error);
  }
};

export const trackEvent = async (eventName: string, properties?: any) => {
  if (!isPostHogInitialized || !process.env.POSTHOG_API_KEY) return;
  
  try {
    const response = await fetch('https://app.posthog.com/capture/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.POSTHOG_API_KEY,
        event: eventName,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          service: 'providers-backend',
          distinct_id: properties?.userId || 'anonymous'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`PostHog API error: ${response.status}`);
    }
  } catch (error) {
    logger.error('Failed to track event:', error);
  }
};

export const trackApiUsage = async (
  endpoint: string,
  method: string,
  responseTime: number,
  statusCode: number,
  userId?: string
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('api_request', {
    endpoint,
    method,
    responseTime,
    statusCode,
    userId,
    service: 'providers-backend',
    category: 'api_usage'
  });
};

export const trackProviderRequest = async (
  provider: string,
  responseTime: number,
  success: boolean,
  errorMessage?: string,
  userId?: string
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('provider_request', {
    provider,
    responseTime,
    success,
    errorMessage,
    userId,
    service: 'providers-backend',
    category: 'provider_performance'
  });
};

export const trackWatchTogetherEvent = async (
  event: string,
  roomId: string,
  userId?: string,
  metadata?: any
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('watch_together_event', {
    event,
    roomId,
    userId,
    service: 'providers-backend',
    category: 'watch_together',
    ...metadata
  });
};

export const trackUserAction = async (
  action: string,
  userId: string,
  metadata?: any
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('user_action', {
    action,
    userId,
    service: 'providers-backend',
    category: 'user_engagement',
    ...metadata
  });
};

export const trackPerformance = async (
  metric: string,
  value: number,
  endpoint?: string,
  userId?: string
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('performance_metric', {
    metric,
    value,
    endpoint,
    userId,
    service: 'providers-backend',
    category: 'performance'
  });
};

export const trackError = async (
  error: string,
  context: string,
  userId?: string,
  metadata?: any
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('error_occurred', {
    error,
    context,
    userId,
    service: 'providers-backend',
    category: 'errors',
    ...metadata
  });
};

export const trackCacheHit = async (
  cacheType: string,
  key: string,
  hit: boolean,
  userId?: string
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('cache_operation', {
    cacheType,
    key: key.substring(0, 50), // Truncate for privacy
    hit,
    userId,
    service: 'providers-backend',
    category: 'cache'
  });
};

export const identifyUser = async (userId: string, properties?: any) => {
  if (!isPostHogInitialized || !process.env.POSTHOG_API_KEY) return;
  
  try {
    const response = await fetch('https://app.posthog.com/capture/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.POSTHOG_API_KEY,
        event: '$identify',
        properties: {
          $set: {
            userId,
            service: 'providers-backend',
            ...properties
          },
          timestamp: new Date().toISOString(),
          distinct_id: userId
        }
      })
    });

    if (!response.ok) {
      throw new Error(`PostHog identify error: ${response.status}`);
    }

    logger.info('User identified in PostHog', { userId });
  } catch (error) {
    logger.error('Failed to identify user:', error);
  }
};

// Provider-specific tracking functions
export const trackProviderStatus = async (
  provider: string,
  status: 'online' | 'offline' | 'degraded',
  responseTime?: number
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('provider_status_change', {
    provider,
    status,
    responseTime,
    service: 'providers-backend',
    category: 'provider_health'
  });
};

export const trackProxyUsage = async (
  proxyUrl: string,
  success: boolean,
  responseTime: number
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('proxy_request', {
    proxyHost: new URL(proxyUrl).host,
    success,
    responseTime,
    service: 'providers-backend',
    category: 'proxy_performance'
  });
};

export const trackWebSocketConnection = async (
  event: 'connected' | 'disconnected' | 'error',
  roomId?: string,
  userId?: string
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('websocket_event', {
    event,
    roomId,
    userId,
    service: 'providers-backend',
    category: 'websocket'
  });
};

// System monitoring events
export const trackSystemMetrics = async (
  memoryUsage: number,
  cpuUsage: number,
  uptime: number
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('system_metrics', {
    memoryUsage,
    cpuUsage,
    uptime,
    service: 'providers-backend',
    category: 'system_health'
  });
};

export const trackHealthCheck = async (
  service: string,
  status: 'healthy' | 'degraded' | 'unhealthy',
  responseTime: number
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('health_check', {
    serviceName: service,
    status,
    responseTime,
    service: 'providers-backend',
    category: 'monitoring'
  });
};

export const trackNotificationSent = async (
  type: 'push' | 'email' | 'webhook',
  success: boolean,
  recipientCount: number
) => {
  if (!isPostHogInitialized) return;

  await trackEvent('notification_sent', {
    type,
    success,
    recipientCount,
    service: 'providers-backend',
    category: 'notifications'
  });
};

export default {
  initPostHog,
  trackEvent,
  trackApiUsage,
  trackProviderRequest,
  trackWatchTogetherEvent,
  trackUserAction,
  trackPerformance,
  trackError,
  trackCacheHit,
  identifyUser,
  trackProviderStatus,
  trackProxyUsage,
  trackWebSocketConnection,
  trackSystemMetrics,
  trackHealthCheck,
  trackNotificationSent
};
import { env } from 'process';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const validateEnvironment = () => {
  const required = ['INTERNAL_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  const optional = ['TMDB_API_KEY', 'ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY', 'POSTHOG_API_KEY', 'SENTRY_DSN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ZONE_ID', 'BETTER_UPTIME_API_KEY', 'BETTER_UPTIME_HEARTBEAT_URL'];
  const missing = required.filter(envVar => !env[envVar]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (env.NODE_ENV === 'production' && env.INTERNAL_API_KEY === 'your-secure-internal-api-key-here') {
    throw new Error('Default internal API key detected in production');
  }

  // Validate Supabase configuration
  if (env.SUPABASE_URL && !env.SUPABASE_URL.includes('supabase.co')) {
    throw new Error('SUPABASE_URL must be a valid Supabase URL');
  }

  if (env.SUPABASE_ANON_KEY && env.SUPABASE_ANON_KEY.trim() === '') {
    throw new Error('SUPABASE_ANON_KEY is empty');
  }

  // Validate API keys are not empty (if provided)
  if (env.TMDB_API_KEY && env.TMDB_API_KEY.trim() === '') {
    throw new Error('TMDB_API_KEY is empty');
  }

  // Validate Upstash Redis configuration
  if (env.UPSTASH_REDIS_REST_URL && !env.UPSTASH_REDIS_REST_URL.includes('upstash.io')) {
    throw new Error('UPSTASH_REDIS_REST_URL must be a valid Upstash Redis URL');
  }

  // Validate rate limiting configuration
  if (env.RATE_LIMIT_MAX_REQUESTS && (parseInt(env.RATE_LIMIT_MAX_REQUESTS) < 1 || parseInt(env.RATE_LIMIT_MAX_REQUESTS) > 10000)) {
    throw new Error('RATE_LIMIT_MAX_REQUESTS must be between 1 and 10000');
  }

  if (env.RATE_LIMIT_WINDOW_MS && (parseInt(env.RATE_LIMIT_WINDOW_MS) < 1000 || parseInt(env.RATE_LIMIT_WINDOW_MS) > 86400000)) {
    throw new Error('RATE_LIMIT_WINDOW_MS must be between 1000 (1 second) and 86400000 (24 hours)');
  }
};

// =================================================================
// SERVER CONFIGURATION
// =================================================================
export const NODE_ENV = env.NODE_ENV || 'production';
export const PORT = parseInt(env.PORT || '3001');
export const RAILWAY_PUBLIC_DOMAIN = env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3001';

// =================================================================
// CORE DATABASE & CACHING
// =================================================================
export const SUPABASE_URL = env.SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || '';
export const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || '';

export const UPSTASH_REDIS_REST_URL = env.UPSTASH_REDIS_REST_URL || '';
export const UPSTASH_REDIS_REST_TOKEN = env.UPSTASH_REDIS_REST_TOKEN || '';

// =================================================================
// AUTHENTICATION & SECURITY
// =================================================================
export const INTERNAL_API_KEY = env.INTERNAL_API_KEY || '';

export const CORS_ORIGIN = env.CORS_ORIGIN || 'http://localhost:3000';
export const CORS_CREDENTIALS = env.CORS_CREDENTIALS === 'true';
export const FRONTEND_URL = env.FRONTEND_URL || 'http://localhost:3000';

export const CSRF_PROTECTION_ENABLED = env.CSRF_PROTECTION_ENABLED === 'true';
export const SSL_ENFORCEMENT_ENABLED = env.SSL_ENFORCEMENT_ENABLED !== 'false';
export const MAX_TOKEN_ROTATIONS = parseInt(env.MAX_TOKEN_ROTATIONS || '5');

// =================================================================
// EXTERNAL APIs
// =================================================================
export const TMDB_API_URL = env.TMDB_API_URL || 'https://api.themoviedb.org/3';
export const TMDB_API_KEY = env.TMDB_API_KEY || '';

export const TRAKT_API_URL = env.TRAKT_API_URL || 'https://api.trakt.tv';
export const TRAKT_CLIENT_ID = env.TRAKT_CLIENT_ID || '';
export const TRAKT_CLIENT_SECRET = env.TRAKT_CLIENT_SECRET || '';

// =================================================================
// MONITORING & ANALYTICS
// =================================================================
export const SENTRY_DSN = env.SENTRY_DSN || '';
export const POSTHOG_API_KEY = env.POSTHOG_API_KEY || '';
export const BETTER_UPTIME_API_KEY = env.BETTER_UPTIME_API_KEY || '';
export const BETTER_UPTIME_HEARTBEAT_URL = env.BETTER_UPTIME_HEARTBEAT_URL || '';


// =================================================================
// NOTIFICATIONS
// =================================================================
export const ONESIGNAL_APP_ID = env.ONESIGNAL_APP_ID || '';
export const ONESIGNAL_REST_API_KEY = env.ONESIGNAL_REST_API_KEY || '';

// =================================================================
// RATE LIMITING
// =================================================================
export const RATE_LIMIT_MAX_REQUESTS = parseInt(env.RATE_LIMIT_MAX_REQUESTS || '100');
export const RATE_LIMIT_WINDOW_MS = parseInt(env.RATE_LIMIT_WINDOW_MS || '60000');

// =================================================================
// API DOCUMENTATION
// =================================================================
export const SWAGGER_TITLE = env.SWAGGER_TITLE || 'Providers Backend API';
export const SWAGGER_DESCRIPTION = env.SWAGGER_DESCRIPTION || 'Advanced API for Streaming Provider Management';
export const SWAGGER_VERSION = env.SWAGGER_VERSION || '2.0.0';
export const SWAGGER_HOST = env.SWAGGER_HOST || 'localhost:3001';

// =================================================================
// WEBSOCKET CONFIGURATION
// =================================================================
export const WEBSOCKET_URL = env.WEBSOCKET_URL || 'ws://localhost:3001';
export const WS_MAX_CONNECTIONS = parseInt(env.WS_MAX_CONNECTIONS || '1000');

// =================================================================
// PROVIDER CONFIGURATION
// =================================================================
export const VIDNEST_BASE_URL = env.VIDNEST_BASE_URL || 'https://vidnest.fun';

// =================================================================
// LOGGING & MONITORING
// =================================================================
export const LOG_LEVEL = env.LOG_LEVEL || 'info';
export const HEALTH_CHECK_TIMEOUT = parseInt(env.HEALTH_CHECK_TIMEOUT || '3000');

// =================================================================
// FEATURE FLAGS
// =================================================================
export const ENABLE_WATCH_TOGETHER = env.ENABLE_WATCH_TOGETHER === 'true';
export const ENABLE_PROVIDERS = env.ENABLE_PROVIDERS === 'true';
export const ENABLE_WEBSOCKET = env.ENABLE_WEBSOCKET !== 'false';
export const ENABLE_CACHING = env.ENABLE_CACHING !== 'false';
export const ENABLE_RATE_LIMITING = env.ENABLE_RATE_LIMITING !== 'false';

// =================================================================
// UTILITY FUNCTIONS
// =================================================================

// Create a function to get environment variables (for services that need them)
export const getEnv = (key: string) => {
  return env[key];
};

// Security status check
export const getSecurityStatus = () => {
  return {
    csrfProtection: CSRF_PROTECTION_ENABLED,
    sslEnforcement: SSL_ENFORCEMENT_ENABLED,
    productionMode: NODE_ENV === 'production',
    supabaseConfigured: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
    redisConfigured: !!(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN),
    monitoringEnabled: !!(SENTRY_DSN || POSTHOG_API_KEY),
    notificationsEnabled: !!(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY)
  };
};

// Health check status
export const getHealthCheckStatus = () => {
  return {
    environment: NODE_ENV,
    port: PORT,
    timestamp: new Date().toISOString(),
    features: {
      watchTogether: ENABLE_WATCH_TOGETHER,
      providers: ENABLE_PROVIDERS,
      websocket: ENABLE_WEBSOCKET,
      caching: ENABLE_CACHING,
      rateLimiting: ENABLE_RATE_LIMITING
    },
    services: {
      supabase: !!SUPABASE_URL,
      redis: !!UPSTASH_REDIS_REST_URL,
      sentry: !!SENTRY_DSN,
      posthog: !!POSTHOG_API_KEY,
      onesignal: !!ONESIGNAL_APP_ID
    }
  };
};
import { env } from 'process';

export const validateEnvironment = () => {
  const required = ['INTERNAL_API_KEY', 'REDIS_URL', 'TMDB_API_KEY'];
  const missing = required.filter(envVar => !env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (env.NODE_ENV === 'production' && env.INTERNAL_API_KEY === 'your-secure-internal-api-key-here') {
    throw new Error('Default internal API key detected in production');
  }
  
  // Validate API keys are not empty
  if (env.TMDB_API_KEY && env.TMDB_API_KEY.trim() === '') {
    throw new Error('TMDB_API_KEY is empty');
  }
  
  if (env.TRAKT_CLIENT_ID && env.TRAKT_CLIENT_ID.trim() === '') {
    throw new Error('TRAKT_CLIENT_ID is empty');
  }
};

// Server Configuration
export const PORT = parseInt(env.PORT || '3001');
export const NODE_ENV = env.NODE_ENV || 'development';
export const SWAGGER_HOST = env.SWAGGER_HOST || env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3001';

// Internal API Authentication
export const INTERNAL_API_KEY = env.INTERNAL_API_KEY || '';

// Redis Configuration
export const REDIS_URL = env.REDIS_URL || 'redis://localhost:6379';
export const REDIS_PASSWORD = env.REDIS_PASSWORD;

// Provider API Configuration
export const TMDB_API_URL = env.TMDB_API_URL || 'https://api.themoviedb.org/3';
export const TMDB_API_KEY = env.TMDB_API_KEY || '';

export const TRAKT_API_URL = env.TRAKT_API_URL || 'https://api.trakt.tv';
export const TRAKT_CLIENT_ID = env.TRAKT_CLIENT_ID || '';
export const TRAKT_CLIENT_SECRET = env.TRAKT_CLIENT_SECRET || '';

// Proxy Configuration
export const PROXY_URLS = env.PROXY_URLS ? env.PROXY_URLS.split(',') : [];
export const PROXY_ROTATION_INTERVAL = parseInt(env.PROXY_ROTATION_INTERVAL || '300000');

// CORS Configuration
export const CORS_ORIGIN = env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : ['*'];

// JWT Configuration
export const JWT_SECRET = env.JWT_SECRET || 'your-jwt-secret-key';
export const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || '15m';

// Rate Limiting
export const RATE_LIMIT_MAX_REQUESTS = parseInt(env.RATE_LIMIT_MAX_REQUESTS || '100');
export const RATE_LIMIT_WINDOW_MS = parseInt(env.RATE_LIMIT_WINDOW_MS || '60000');

// WebSocket Configuration
export const WS_PORT = parseInt(env.WS_PORT || '3002');
export const WS_MAX_CONNECTIONS = parseInt(env.WS_MAX_CONNECTIONS || '1000');
export const WEBSOCKET_URL = env.WEBSOCKET_URL || 'ws://localhost:3002';

// Healthchecks.io
export const HEALTHCHECKS_IO_URL = env.HEALTHCHECKS_IO_URL;

// Logging
export const LOG_LEVEL = env.LOG_LEVEL || 'info';
export const LOG_FILE = env.LOG_FILE || 'logs/app.log';

// Create a function to get environment variables (for services that need them)
export const getEnv = (key: string) => {
  return env[key];
};
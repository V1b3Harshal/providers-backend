import { env } from 'process';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const validateEnvironment = () => {
  const required = ['INTERNAL_API_KEY', 'REDIS_URL', 'TMDB_API_KEY', 'JWT_SECRET'];
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
  
  if (env.JWT_SECRET && env.JWT_SECRET.trim() === '') {
    throw new Error('JWT_SECRET is empty');
  }
  
  // Security validation for JWT secrets
  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }

  // Validate session configuration
  if (env.SESSION_TIMEOUT_MS && (parseInt(env.SESSION_TIMEOUT_MS) < 60000 || parseInt(env.SESSION_TIMEOUT_MS) > 86400000)) {
    throw new Error('SESSION_TIMEOUT_MS must be between 60000 (1 minute) and 86400000 (24 hours)');
  }

  // Validate token rotation configuration
  if (env.TOKEN_ROTATION_INTERVAL_MS && (parseInt(env.TOKEN_ROTATION_INTERVAL_MS) < 300000 || parseInt(env.TOKEN_ROTATION_INTERVAL_MS) > 3600000)) {
    throw new Error('TOKEN_ROTATION_INTERVAL_MS must be between 300000 (5 minutes) and 3600000 (1 hour)');
  }
};

// Server Configuration
export const PORT = parseInt(env.PORT || '3001');
export const NODE_ENV = env.NODE_ENV || 'development';
export const SWAGGER_HOST = env.SWAGGER_HOST || env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3001';

// Railway-specific configurations
export const RAILWAY_DOMAIN = env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3001';

// Internal API Authentication
export const INTERNAL_API_KEY = env.INTERNAL_API_KEY || '';

// Redis Configuration - Prioritize Upstash
export const REDIS_URL = env.UPSTASH_REDIS_URL || env.REDIS_URL || 'redis://localhost:6379';
export const REDIS_PASSWORD = env.REDIS_PASSWORD;

// Upstash Redis Configuration - Primary Redis
export const UPSTASH_REDIS_URL = env.UPSTASH_REDIS_URL || env.REDIS_URL;
export const UPSTASH_REDIS_TOKEN = env.UPSTASH_REDIS_TOKEN;

// Upstash-specific configurations - Check if Redis URL contains Upstash domain
export const UPSTASH_REDIS_ENABLED = !!env.REDIS_URL?.includes('upstash.io') || !!env.UPSTASH_REDIS_URL;
export const UPSTASH_REDIS_HOST = env.REDIS_URL?.includes('upstash.io') ? new URL(env.REDIS_URL).hostname :
                                 (env.UPSTASH_REDIS_URL ? new URL(env.UPSTASH_REDIS_URL).hostname : '');
export const UPSTASH_REDIS_PORT = env.REDIS_URL?.includes('upstash.io') ? parseInt(new URL(env.REDIS_URL).port) :
                                 (env.UPSTASH_REDIS_URL ? parseInt(new URL(env.UPSTASH_REDIS_URL).port) : 6379);


// Provider API Configuration
export const TMDB_API_URL = env.TMDB_API_URL || 'https://api.themoviedb.org/3';
export const TMDB_API_KEY = env.TMDB_API_KEY || '';

export const TRAKT_API_URL = env.TRAKT_API_URL || 'https://api.trakt.tv';
export const TRAKT_CLIENT_ID = env.TRAKT_CLIENT_ID || '';
export const TRAKT_CLIENT_SECRET = env.TRAKT_CLIENT_SECRET || '';

// Provider Configuration
export const VIDNEST_BASE_URL = env.VIDNEST_BASE_URL || 'https://vidnest.fun';

// CORS Configuration
export const CORS_ORIGIN = env.CORS_ORIGIN || env.FRONTEND_URL || 'http://localhost:3000';

// JWT Configuration
export const JWT_SECRET = env.JWT_SECRET || 'your-jwt-secret-key';
export const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET || 'your-jwt-refresh-secret-key';
export const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || '15m';
export const JWT_REFRESH_EXPIRES_IN = env.JWT_REFRESH_EXPIRES_IN || '7d';

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

// Security Configuration
export const SESSION_TIMEOUT_MS = parseInt(env.SESSION_TIMEOUT_MS || '1800000'); // 30 minutes default
export const TOKEN_ROTATION_INTERVAL_MS = parseInt(env.TOKEN_ROTATION_INTERVAL_MS || '300000'); // 5 minutes default
export const MAX_TOKEN_ROTATIONS = parseInt(env.MAX_TOKEN_ROTATIONS || '5'); // Max rotations per session
export const CSRF_PROTECTION_ENABLED = env.CSRF_PROTECTION_ENABLED === 'true';
export const SSL_ENFORCEMENT_ENABLED = env.SSL_ENFORCEMENT_ENABLED !== 'false';

// Database SSL Configuration
export const MONGODB_SSL_CA_FILE = env.MONGODB_SSL_CA_FILE || '';
export const MONGODB_SSL_CERT_FILE = env.MONGODB_SSL_CERT_FILE || '';
export const MONGODB_SSL_KEY_FILE = env.MONGODB_SSL_KEY_FILE || '';

// Create a function to get environment variables (for services that need them)
export const getEnv = (key: string) => {
  return env[key];
};

// Security status check
export const getSecurityStatus = () => {
  return {
    jwtSecretLength: env.JWT_SECRET?.length || 0,
    sessionTimeout: SESSION_TIMEOUT_MS,
    tokenRotationInterval: TOKEN_ROTATION_INTERVAL_MS,
    csrfProtection: CSRF_PROTECTION_ENABLED,
    sslEnforcement: SSL_ENFORCEMENT_ENABLED,
    productionMode: NODE_ENV === 'production',
    mongoUriSsl: env.MONGODB_URI?.includes('ssl=true') || env.MONGODB_URI?.includes('tls=true') || false
  };
};
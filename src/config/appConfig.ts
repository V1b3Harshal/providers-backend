import { env } from 'process';

export interface AppConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  security: {
    helmet: {
      contentSecurityPolicy: any;
      hsts: any;
    };
    additionalHeaders: Record<string, string>;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  swagger: {
    title: string;
    description: string;
    version: string;
    host: string;
  };
}

export const getAppConfig = (): AppConfig => {
  const port = parseInt(env.PORT || '3001');
  const host = '0.0.0.0';
  
  // CORS configuration
  const corsOrigin = env.NODE_ENV === 'production'
    ? (env.CORS_ORIGIN?.split(',').filter(Boolean) || [env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3001'])
    : env.FRONTEND_URL || 'http://localhost:3000';

  return {
    port,
    host,
    cors: {
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-key', 'x-csrf-token'],
    },
    security: {
      helmet: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.themoviedb.org", "https://api.trakt.tv", "ws:", "wss:"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      },
      additionalHeaders: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      },
    },
    rateLimit: {
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || '60000'),
      maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS || '100'),
    },
    swagger: {
      title: env.SWAGGER_TITLE || 'Providers Backend API',
      description: env.SWAGGER_DESCRIPTION || 'API for streaming provider management and watch-together functionality',
      version: env.SWAGGER_VERSION || '1.0.0',
      host: env.SWAGGER_HOST || env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3001',
    },
  };
};
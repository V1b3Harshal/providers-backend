import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { connectToRedis, getRedisClient } from './config/redis';
import { validateEnvironment } from './config/environment';
import { createSafeErrorResponse, logErrorWithDetails } from './utils/errorHandler';
import { logger } from './utils/logger';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { getAppConfig } from './config/appConfig';
import { initSentry } from './config/sentry';
import { initPostHog } from './config/posthog';
import { initSupabase } from './config/supabase';
import { initOneSignal } from './config/onesignal';
import betterUptimeService from './config/betterUptime';
import userRateLimitService from './services/userRateLimitService';

// Import routes
import providerRoutes from './routes/providers';
import watchTogetherRoutes from './routes/watchTogether';
import notificationsRoutes from './routes/notifications';

// Load environment variables from .env file
dotenv.config();
validateEnvironment();

const config = getAppConfig();
const fastify = Fastify({ logger: false }); // We'll use our custom logger

fastify.register(cors, config.cors);

fastify.register(helmet, config.security.helmet);

fastify.register(rateLimit, {
  global: true,
  max: config.rateLimit.maxRequests,
  timeWindow: config.rateLimit.windowMs,
  skip: async (request: any) => {
    // Skip rate limiting for internal API calls
    return request.headers['x-internal-key'] === process.env.INTERNAL_API_KEY;
  },
  addHeaders: (request: any, reply: any, limit: any) => {
    reply.header('X-RateLimit-Limit', limit.max);
    reply.header('X-RateLimit-Remaining', limit.remaining);
    reply.header('X-RateLimit-Reset', limit.resetTime);
  },
  ban: 0,
  allowList: (request: any, key: string) => {
    // Allow all requests with internal key
    return request.headers['x-internal-key'] === process.env.INTERNAL_API_KEY;
  },
  // Add per-user rate limiting hook
  onRequest: async (request: any, reply: any) => {
    // Skip for internal API calls
    if (request.headers['x-internal-key'] === process.env.INTERNAL_API_KEY) {
      return;
    }

    // Get user identifier (IP address as fallback, or user ID if authenticated)
    const userId = request.user?.id || request.user?.userId || request.ip || 'anonymous';

    try {
      const userLimitResult = await userRateLimitService.checkUserLimit(userId, request.url);

      if (!userLimitResult.allowed) {
        if (userLimitResult.isBlocked) {
          logger.warn(`User ${userId} is blocked from rate limiting until ${new Date(userLimitResult.blockedUntil!).toISOString()}`);
          return reply.code(429).send({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'You have been temporarily blocked due to excessive requests. Please try again later.',
            retryAfter: Math.ceil((userLimitResult.blockedUntil! - Date.now()) / 1000)
          });
        } else {
          logger.warn(`User ${userId} exceeded per-user rate limit`);
          return reply.code(429).send({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'You have exceeded your request limit. Please try again later.',
            retryAfter: Math.ceil((userLimitResult.resetTime - Date.now()) / 1000)
          });
        }
      }

      // Add rate limit headers for user limits
      reply.header('X-User-RateLimit-Limit', 50); // 50 requests per minute
      reply.header('X-User-RateLimit-Remaining', userLimitResult.remaining);
      reply.header('X-User-RateLimit-Reset', userLimitResult.resetTime);

    } catch (error) {
      logger.error('User rate limiting failed:', error);
      // Continue with request if rate limiting fails
    }
  }
} as any);

// Register Swagger plugins
fastify.register(require('@fastify/swagger'), {
  swagger: {
    info: {
      title: config.swagger.title,
      description: config.swagger.description,
      version: config.swagger.version,
    },
    host: config.swagger.host,
    schemes: ['https', 'http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
      internalApiKey: {
        type: 'apiKey',
        name: 'x-internal-key',
        in: 'header',
        description: 'Internal API key for backend-to-backend communication'
      }
    }
  },
});

fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: true,
  },
  staticCSP: true,
  transformStaticCSP: (header: any) => header,
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const { getSupabaseHealth } = await import('./config/supabase');
  const { oneSignalService } = await import('./config/onesignal');
  const { getRedisHealth } = await import('./config/redis');

  const supabaseHealth = await getSupabaseHealth();
  const redisHealth = await getRedisHealth();
  const userRateLimitStats = await userRateLimitService.getGlobalStats();

  // Memory usage monitoring
  const memUsage = process.memoryUsage();
  const performance = {
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    uptime: Math.round(process.uptime()), // seconds
    score: memUsage.rss < 100 * 1024 * 1024 ? 100 : 70 // Simple performance score
  };

  reply.send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'providers-backend',
    message: 'Server is running',
    performance,
    rateLimiting: {
      global: {
        maxRequests: config.rateLimit.maxRequests,
        windowMs: config.rateLimit.windowMs
      },
      userLimits: userRateLimitStats
    },
    services: {
      supabase: supabaseHealth.status,
      redis: redisHealth.status,
      oneSignal: oneSignalService.getStatus(),
      betterUptime: betterUptimeService.getStatus()
    }
  });
});

// Test endpoint
fastify.get('/test', (request, reply) => {
  reply.send({ message: 'Test successful' });
});

// Security status endpoint
fastify.get('/security/status', async () => {
  const { getSecurityStatus } = await import('./config/environment');

  return {
    timestamp: new Date().toISOString(),
    security: {
      ...getSecurityStatus(),
      csrfProtectionEnabled: process.env.CSRF_PROTECTION_ENABLED === 'true',
      sslEnforcementEnabled: process.env.SSL_ENFORCEMENT_ENABLED !== 'false',
      sessionManagement: {
        timeout: 3600000, // 1 hour default
        rotationInterval: 300000, // 5 minutes default
        maxRotations: process.env.MAX_TOKEN_ROTATIONS || '5'
      }
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      isProduction: process.env.NODE_ENV === 'production'
    }
  };
});

// Error monitoring endpoint
fastify.get('/monitoring/errors', async () => {
  const { errorMonitoringService } = await import('./services/errorMonitoringService');

  const metrics = errorMonitoringService.getMetrics();
  const recentErrors = await errorMonitoringService.getRecentErrors(20);

  return {
    timestamp: new Date().toISOString(),
    service: 'providers-backend',
    metrics,
    recentErrors,
    alerts: {
      errorRateThreshold: 10, // errors per minute
      consecutiveErrorsThreshold: 5,
      alertCooldownMinutes: 10
    }
  };
});

// CSRF token endpoint
fastify.get('/csrf-token', {
  preHandler: [async (request, reply) => {
    // Add CSRF protection logic here
  }]
}, async (request, reply) => {
  return {
    csrfToken: 'csrf-token-placeholder',
    timestamp: new Date().toISOString()
  };
});

// API configuration endpoint
fastify.get('/api/config', async () => {
  return {
    websocketUrl: process.env.WEBSOCKET_URL || `ws://${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3001'}`,
    apiBaseUrl: process.env.RAILWAY_PUBLIC_DOMAIN || `localhost:3001`,
    features: {
      watchTogether: true,
      providers: true,
      webSocket: true
    },
    timestamp: new Date().toISOString()
  };
});

fastify.get('/', async () => {
  return { message: 'Welcome to Providers Backend!' };
});

// Register routes with versioning
fastify.register(providerRoutes, { prefix: '/v1/providers' });
fastify.register(watchTogetherRoutes, { prefix: '/v1/watch-together' });
fastify.register(notificationsRoutes, { prefix: '/v1/notifications' });

// Legacy routes without versioning for backward compatibility
fastify.register(providerRoutes, { prefix: '/providers' });
fastify.register(watchTogetherRoutes, { prefix: '/watch-together' });
fastify.register(notificationsRoutes, { prefix: '/notifications' });

const start = async () => {
  try {
    // Initialize third-party services
    logger.info('Initializing third-party services...');

    // Initialize Supabase
    initSupabase();

    // Initialize OneSignal
    initOneSignal();

    // Initialize Sentry
    initSentry();

    // Initialize PostHog
    initPostHog();

    // Initialize Better Uptime
    betterUptimeService.init();

    logger.info('All third-party services initialized');
    
    // Connect to Redis first
    await connectToRedis();
    logger.info('Connected to Redis successfully');
    
    // Set up Socket.IO
    const io = new Server(fastify.server, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    // For in-memory Redis, we'll use a simple in-memory adapter
    // If we need Redis adapter later, we can implement a custom one
    logger.info('Using in-memory adapter for Socket.IO (Redis adapter requires real Redis client)');
    
    // Attach Socket.IO instance to Fastify for use in routes
    (fastify as any).io = io;
    
    // Start the server
    try {
      await fastify.listen({ port: config.port, host: config.host });
      logger.info(`Providers Backend listening on http://${config.host}:${config.port}`);
      logger.info(`Swagger docs available at http://${config.host}:${config.port}/docs`);
      logger.info('WebSocket server ready for connections');
    } catch (error) {
      if (error instanceof Error && error.message.includes('EADDRINUSE')) {
        logger.warn(`Port ${config.port} is already in use, trying alternative port ${config.port + 1}`);
        try {
          await fastify.listen({ port: config.port + 1, host: config.host });
          logger.info(`Providers Backend listening on http://${config.host}:${config.port + 1}`);
          logger.info(`Swagger docs available at http://${config.host}:${config.port + 1}/docs`);
          logger.info('WebSocket server ready for connections');
        } catch (altError) {
          logger.error('Failed to start server on alternative port:', altError instanceof Error ? altError.message : String(altError));
          process.exit(1);
        }
      } else {
        logger.error('Failed to start server:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    }
  } catch (err) {
    logErrorWithDetails(err, { context: 'Server startup' });
    logger.error('Failed to start server');
    process.exit(1);
  }
};

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  logErrorWithDetails(error, {
    url: request.url,
    method: request.method,
    ip: request.ip
  });
  
  const safeError = createSafeErrorResponse(error);
  reply.code(safeError.statusCode).send(safeError);
});

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  const safeError = createSafeErrorResponse(new Error('Route not found'), 404);
  reply.code(safeError.statusCode).send(safeError);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    // Stop accepting new connections
    await fastify.close();

    // Close Redis connections
    try {
      const redis = getRedisClient();
      if (redis && typeof redis.disconnect === 'function') {
        await redis.disconnect();
        logger.info('Redis connection closed');
      }
    } catch (redisError) {
      logger.warn('Error closing Redis connection:', redisError);
    }

    // Close Socket.IO connections
    try {
      const io = (fastify as any).io;
      if (io) {
        io.close();
        logger.info('Socket.IO connections closed');
      }
    } catch (socketError) {
      logger.warn('Error closing Socket.IO connections:', socketError);
    }


    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Register signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Request logging disabled to prevent hanging issues in production
// Alternative: Use middleware that doesn't interfere with request lifecycle

start();
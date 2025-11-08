import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { connectToRedis, getRedisClient } from './config/redis';
import { validateEnvironment } from './config/environment';
import { createSafeErrorResponse, logErrorWithDetails } from './utils/errorHandler';
import { logger } from './utils/logger';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import '@fastify/jwt';
import dotenv from 'dotenv';
import { getAppConfig } from './config/appConfig';
import { providerService } from './services/providerService';

// Import routes
import providerRoutes from './routes/providers';
import watchTogetherRoutes from './routes/watchTogether';

// Load environment variables from .env file
dotenv.config();
validateEnvironment();

const config = getAppConfig();
const fastify = Fastify({ logger: false }); // We'll use our custom logger

// Initialize JWT plugin
fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET!,
});

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
fastify.get('/health', (request, reply) => {
  reply.send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'providers-backend',
    message: 'Server is running'
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
        timeout: getSecurityStatus().sessionTimeout,
        rotationInterval: getSecurityStatus().tokenRotationInterval,
        maxRotations: process.env.MAX_TOKEN_ROTATIONS || '5'
      }
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      isProduction: process.env.NODE_ENV === 'production'
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

// Register routes
fastify.register(providerRoutes, { prefix: '/providers' });
fastify.register(watchTogetherRoutes, { prefix: '/watch-together' });

const start = async () => {
  try {
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

// Request logging disabled to prevent hanging issues in production
// Alternative: Use middleware that doesn't interfere with request lifecycle

start();
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { connectToRedis, getRedisClient } from './config/redis';
import { validateEnvironment } from './config/environment';
import { INTERNAL_API_KEY, CORS_ORIGIN, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from './config/environment';
import { createSafeErrorResponse, logErrorWithDetails } from './utils/errorHandler';
import { logger } from './utils/logger';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

// Import routes
import providerRoutes from './routes/providers';
import watchTogetherRoutes from './routes/watchTogether';

// Load environment variables
validateEnvironment();

const fastify = Fastify({
  logger: false, // We'll use our custom logger
});

// Enable CORS for frontend interaction
fastify.register(cors, {
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-key'],
});

// Add comprehensive security headers with Helmet
fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Add additional security headers
fastify.addHook('onRequest', (request, reply, done) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  done();
});

// Add rate limiting
fastify.register(rateLimit, {
  global: true,
  max: RATE_LIMIT_MAX_REQUESTS,
  timeWindow: RATE_LIMIT_WINDOW_MS,
  skip: (request: any) => {
    // Skip rate limiting for internal API calls
    return request.headers['x-internal-key'] === INTERNAL_API_KEY;
  },
  addHeaders: (request: any, reply: any, limit: any) => {
    reply.header('X-RateLimit-Limit', limit.max);
    reply.header('X-RateLimit-Remaining', limit.remaining);
    reply.header('X-RateLimit-Reset', limit.resetTime);
  }
} as any);

// Register Swagger
fastify.register(import('@fastify/swagger'), {
  swagger: {
    info: {
      title: 'Providers Backend API',
      description: 'API for streaming provider management and watch-together functionality',
      version: '1.0.0',
    },
    host: process.env.SWAGGER_HOST || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3001',
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

// Register Swagger UI
fastify.register(import('@fastify/swagger-ui'), {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: true,
  },
  staticCSP: true,
  transformStaticCSP: (header: any) => header,
});

// Health check endpoint
fastify.get('/health', async () => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'providers-backend'
  };
});

// Register routes
fastify.register(providerRoutes, { prefix: '/providers' });
fastify.register(watchTogetherRoutes, { prefix: '/watch-together' });

const start = async () => {
  try {
    // Connect to Redis first
    await connectToRedis();
    logger.info('Connected to Redis successfully');
    
    // Set up Socket.IO with Redis adapter
    const io = new Server(fastify.server, {
      cors: {
        origin: CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    // Set up Redis adapter for Socket.IO
    const pubClient = getRedisClient();
    const subClient = pubClient.duplicate();
    const redisAdapter = createAdapter(pubClient, subClient);
    io.adapter(redisAdapter);
    
    // Attach Socket.IO instance to Fastify for use in routes
    (fastify as any).io = io;
    
    // Then start the server
    const port = parseInt(process.env.PORT || '3001');
    await fastify.listen({ port, host: '0.0.0.0' });
    logger.info(`Providers Backend listening on http://0.0.0.0:${port}`);
    logger.info(`Swagger docs available at http://0.0.0.0:${port}/docs`);
    logger.info('WebSocket server ready for connections');
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

// Add security-focused request logging
fastify.addHook('onRequest', (request, reply, done) => {
  logger.http({
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    timestamp: new Date().toISOString(),
    contentType: request.headers['content-type'],
    contentLength: request.headers['content-length'],
  });
  done();
});

start();
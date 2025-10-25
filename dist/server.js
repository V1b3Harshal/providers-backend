"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const redis_1 = require("./config/redis");
const environment_1 = require("./config/environment");
const environment_2 = require("./config/environment");
const errorHandler_1 = require("./utils/errorHandler");
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const providers_1 = __importDefault(require("./routes/providers"));
const watchTogether_1 = __importDefault(require("./routes/watchTogether"));
(0, environment_1.validateEnvironment)();
const fastify = (0, fastify_1.default)({
    logger: process.env.NODE_ENV === 'production' ? true : {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname'
            }
        }
    }
});
fastify.register(cors_1.default, {
    origin: environment_2.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-key'],
});
fastify.register(helmet_1.default, {
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
fastify.addHook('onRequest', (request, reply, done) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    done();
});
fastify.register(rate_limit_1.default, {
    global: true,
    max: environment_2.RATE_LIMIT_MAX_REQUESTS,
    timeWindow: environment_2.RATE_LIMIT_WINDOW_MS,
    skip: (request) => {
        return request.headers['x-internal-key'] === environment_2.INTERNAL_API_KEY;
    },
    addHeaders: (request, reply, limit) => {
        reply.header('X-RateLimit-Limit', limit.max);
        reply.header('X-RateLimit-Remaining', limit.remaining);
        reply.header('X-RateLimit-Reset', limit.resetTime);
    }
});
fastify.register(Promise.resolve().then(() => __importStar(require('@fastify/swagger'))), {
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
fastify.register(Promise.resolve().then(() => __importStar(require('@fastify/swagger-ui'))), {
    routePrefix: '/docs',
    uiConfig: {
        docExpansion: 'full',
        deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
});
fastify.get('/health', async () => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'providers-backend'
    };
});
fastify.register(providers_1.default, { prefix: '/providers' });
fastify.register(watchTogether_1.default, { prefix: '/watch-together' });
const start = async () => {
    try {
        await (0, redis_1.connectToRedis)();
        console.log('Connected to Redis successfully');
        const io = new socket_io_1.Server(fastify.server, {
            cors: {
                origin: environment_2.CORS_ORIGIN,
                methods: ['GET', 'POST'],
                credentials: true
            }
        });
        const pubClient = (0, redis_1.getRedisClient)();
        const subClient = pubClient.duplicate();
        const redisAdapter = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
        io.adapter(redisAdapter);
        fastify.io = io;
        const port = parseInt(process.env.PORT || '3001');
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`Providers Backend listening on http://0.0.0.0:${port}`);
        console.log(`Swagger docs available at http://0.0.0.0:${port}/docs`);
        console.log('WebSocket server ready for connections');
    }
    catch (err) {
        (0, errorHandler_1.logErrorWithDetails)(err, { context: 'Server startup' });
        fastify.log.error('Failed to start server');
        process.exit(1);
    }
};
fastify.setErrorHandler((error, request, reply) => {
    (0, errorHandler_1.logErrorWithDetails)(error, {
        url: request.url,
        method: request.method,
        ip: request.ip
    });
    const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
    reply.code(safeError.statusCode).send(safeError);
});
fastify.setNotFoundHandler((request, reply) => {
    const safeError = (0, errorHandler_1.createSafeErrorResponse)(new Error('Route not found'), 404);
    reply.code(safeError.statusCode).send(safeError);
});
fastify.addHook('onRequest', (request, reply, done) => {
    fastify.log.info({
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
//# sourceMappingURL=server.js.map
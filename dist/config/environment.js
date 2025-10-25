"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnv = exports.LOG_FILE = exports.LOG_LEVEL = exports.HEALTHCHECKS_IO_URL = exports.WS_MAX_CONNECTIONS = exports.WS_PORT = exports.RATE_LIMIT_WINDOW_MS = exports.RATE_LIMIT_MAX_REQUESTS = exports.JWT_EXPIRES_IN = exports.JWT_SECRET = exports.CORS_ORIGIN = exports.PROXY_ROTATION_INTERVAL = exports.PROXY_URLS = exports.TRAKT_CLIENT_SECRET = exports.TRAKT_CLIENT_ID = exports.TRAKT_API_URL = exports.TMDB_API_KEY = exports.TMDB_API_URL = exports.REDIS_PASSWORD = exports.REDIS_URL = exports.INTERNAL_API_KEY = exports.NODE_ENV = exports.PORT = exports.validateEnvironment = void 0;
const process_1 = require("process");
const validateEnvironment = () => {
    const required = ['INTERNAL_API_KEY', 'REDIS_URL', 'TMDB_API_KEY'];
    const missing = required.filter(envVar => !process_1.env[envVar]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    if (process_1.env.NODE_ENV === 'production' && process_1.env.INTERNAL_API_KEY === 'your-secure-internal-api-key-here') {
        throw new Error('Default internal API key detected in production');
    }
    if (process_1.env.TMDB_API_KEY && process_1.env.TMDB_API_KEY.trim() === '') {
        throw new Error('TMDB_API_KEY is empty');
    }
    if (process_1.env.TRAKT_CLIENT_ID && process_1.env.TRAKT_CLIENT_ID.trim() === '') {
        throw new Error('TRAKT_CLIENT_ID is empty');
    }
};
exports.validateEnvironment = validateEnvironment;
exports.PORT = parseInt(process_1.env.PORT || '3001');
exports.NODE_ENV = process_1.env.NODE_ENV || 'development';
exports.INTERNAL_API_KEY = process_1.env.INTERNAL_API_KEY || '';
exports.REDIS_URL = process_1.env.REDIS_URL || 'redis://localhost:6379';
exports.REDIS_PASSWORD = process_1.env.REDIS_PASSWORD;
exports.TMDB_API_URL = process_1.env.TMDB_API_URL || 'https://api.themoviedb.org/3';
exports.TMDB_API_KEY = process_1.env.TMDB_API_KEY || '';
exports.TRAKT_API_URL = process_1.env.TRAKT_API_URL || 'https://api.trakt.tv';
exports.TRAKT_CLIENT_ID = process_1.env.TRAKT_CLIENT_ID || '';
exports.TRAKT_CLIENT_SECRET = process_1.env.TRAKT_CLIENT_SECRET || '';
exports.PROXY_URLS = process_1.env.PROXY_URLS ? process_1.env.PROXY_URLS.split(',') : [];
exports.PROXY_ROTATION_INTERVAL = parseInt(process_1.env.PROXY_ROTATION_INTERVAL || '300000');
exports.CORS_ORIGIN = process_1.env.CORS_ORIGIN ? process_1.env.CORS_ORIGIN.split(',') : ['*'];
exports.JWT_SECRET = process_1.env.JWT_SECRET || 'your-jwt-secret-key';
exports.JWT_EXPIRES_IN = process_1.env.JWT_EXPIRES_IN || '15m';
exports.RATE_LIMIT_MAX_REQUESTS = parseInt(process_1.env.RATE_LIMIT_MAX_REQUESTS || '100');
exports.RATE_LIMIT_WINDOW_MS = parseInt(process_1.env.RATE_LIMIT_WINDOW_MS || '60000');
exports.WS_PORT = parseInt(process_1.env.WS_PORT || '3002');
exports.WS_MAX_CONNECTIONS = parseInt(process_1.env.WS_MAX_CONNECTIONS || '1000');
exports.HEALTHCHECKS_IO_URL = process_1.env.HEALTHCHECKS_IO_URL;
exports.LOG_LEVEL = process_1.env.LOG_LEVEL || 'info';
exports.LOG_FILE = process_1.env.LOG_FILE || 'logs/app.log';
const getEnv = (key) => {
    return process_1.env[key];
};
exports.getEnv = getEnv;
//# sourceMappingURL=environment.js.map
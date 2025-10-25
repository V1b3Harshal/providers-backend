"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupExpiredKeys = exports.getRateLimitCount = exports.incrementRateLimit = exports.getProxyHealth = exports.setProxyHealth = exports.getProviderCache = exports.setProviderCache = exports.getRoomState = exports.setRoomState = exports.getRoomParticipants = exports.removeRoomParticipant = exports.addRoomParticipant = exports.deleteRoom = exports.getRoom = exports.setRoom = exports.RedisKeys = exports.disconnectFromRedis = exports.getRedisClient = exports.connectToRedis = void 0;
const redis_1 = require("redis");
const environment_1 = require("./environment");
let redisClient = null;
const connectToRedis = async () => {
    try {
        const options = {
            url: environment_1.REDIS_URL,
        };
        if (environment_1.REDIS_PASSWORD) {
            options.password = environment_1.REDIS_PASSWORD;
        }
        redisClient = (0, redis_1.createClient)(options);
        redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });
        redisClient.on('connect', () => {
            console.log('Connected to Redis successfully');
        });
        redisClient.on('reconnecting', () => {
            console.log('Reconnecting to Redis...');
        });
        redisClient.on('end', () => {
            console.log('Redis connection ended');
        });
        await redisClient.connect();
        return redisClient;
    }
    catch (error) {
        console.error('Redis connection error:', error);
        throw error;
    }
};
exports.connectToRedis = connectToRedis;
const getRedisClient = () => {
    if (!redisClient) {
        throw new Error('Redis client not initialized. Call connectToRedis first.');
    }
    return redisClient;
};
exports.getRedisClient = getRedisClient;
const disconnectFromRedis = async () => {
    if (redisClient) {
        await redisClient.quit();
        console.log('Disconnected from Redis');
    }
};
exports.disconnectFromRedis = disconnectFromRedis;
exports.RedisKeys = {
    rooms: 'room:',
    roomParticipants: 'room:participants:',
    roomState: 'room:state:',
    providerCache: 'provider:',
    providerHealth: 'provider:health:',
    proxyHealth: 'proxy:health:',
    proxyStats: 'proxy:stats:',
    rateLimit: 'rate_limit:',
    sessions: 'session:',
    cache: 'cache:',
};
const setRoom = async (roomId, roomData) => {
    const client = (0, exports.getRedisClient)();
    const key = `${exports.RedisKeys.rooms}${roomId}`;
    await client.setEx(key, 3600, JSON.stringify(roomData));
};
exports.setRoom = setRoom;
const getRoom = async (roomId) => {
    const client = (0, exports.getRedisClient)();
    const key = `${exports.RedisKeys.rooms}${roomId}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
};
exports.getRoom = getRoom;
const deleteRoom = async (roomId) => {
    const client = (0, exports.getRedisClient)();
    const key = `${exports.RedisKeys.rooms}${roomId}`;
    await client.del(key);
};
exports.deleteRoom = deleteRoom;
const addRoomParticipant = async (roomId, userId) => {
    const client = (0, exports.getRedisClient)();
    const key = `${exports.RedisKeys.roomParticipants}${roomId}`;
    await client.sAdd(key, userId);
    await client.expire(key, 3600);
};
exports.addRoomParticipant = addRoomParticipant;
const removeRoomParticipant = async (roomId, userId) => {
    const client = (0, exports.getRedisClient)();
    const key = `${exports.RedisKeys.roomParticipants}${roomId}`;
    await client.sRem(key, userId);
};
exports.removeRoomParticipant = removeRoomParticipant;
const getRoomParticipants = async (roomId) => {
    const client = (0, exports.getRedisClient)();
    const key = `${exports.RedisKeys.roomParticipants}${roomId}`;
    return await client.sMembers(key);
};
exports.getRoomParticipants = getRoomParticipants;
const setRoomState = async (roomId, state) => {
    const client = (0, exports.getRedisClient)();
    const key = `${exports.RedisKeys.roomState}${roomId}`;
    await client.setEx(key, 3600, JSON.stringify(state));
};
exports.setRoomState = setRoomState;
const getRoomState = async (roomId) => {
    const client = (0, exports.getRedisClient)();
    const key = `${exports.RedisKeys.roomState}${roomId}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
};
exports.getRoomState = getRoomState;
const setProviderCache = async (provider, key, data, ttl = 21600) => {
    const client = (0, exports.getRedisClient)();
    const cacheKey = `${exports.RedisKeys.providerCache}${provider}:${key}`;
    await client.setEx(cacheKey, ttl, JSON.stringify(data));
};
exports.setProviderCache = setProviderCache;
const getProviderCache = async (provider, key) => {
    const client = (0, exports.getRedisClient)();
    const cacheKey = `${exports.RedisKeys.providerCache}${provider}:${key}`;
    const data = await client.get(cacheKey);
    return data ? JSON.parse(data) : null;
};
exports.getProviderCache = getProviderCache;
const setProxyHealth = async (proxyUrl, isHealthy) => {
    const client = (0, exports.getRedisClient)();
    const key = `${exports.RedisKeys.proxyHealth}${proxyUrl}`;
    await client.setEx(key, 3600, isHealthy.toString());
};
exports.setProxyHealth = setProxyHealth;
const getProxyHealth = async (proxyUrl) => {
    const client = (0, exports.getRedisClient)();
    const key = `${exports.RedisKeys.proxyHealth}${proxyUrl}`;
    const data = await client.get(key);
    return data === 'true';
};
exports.getProxyHealth = getProxyHealth;
const incrementRateLimit = async (key, windowMs) => {
    const client = (0, exports.getRedisClient)();
    const now = Date.now();
    const windowStart = now - windowMs;
    await client.zRemRangeByScore(key, 0, windowStart);
    await client.zAdd(key, [{ score: now, value: now.toString() }]);
    await client.expire(key, Math.ceil(windowMs / 1000));
    const currentCount = await client.zCard(key);
    return currentCount;
};
exports.incrementRateLimit = incrementRateLimit;
const getRateLimitCount = async (key) => {
    const client = (0, exports.getRedisClient)();
    return await client.zCard(key);
};
exports.getRateLimitCount = getRateLimitCount;
const cleanupExpiredKeys = async () => {
    const client = (0, exports.getRedisClient)();
    const patterns = [
        `${exports.RedisKeys.rooms}*`,
        `${exports.RedisKeys.roomParticipants}*`,
        `${exports.RedisKeys.roomState}*`,
        `${exports.RedisKeys.providerCache}*`,
        `${exports.RedisKeys.proxyHealth}*`,
    ];
    try {
        for (const pattern of patterns) {
            const keys = await client.keys(pattern);
            if (keys.length > 0) {
                await client.del(keys);
                console.log(`Cleaned up ${keys.length} expired keys for pattern: ${pattern}`);
            }
        }
    }
    catch (error) {
        console.error('Error cleaning up expired keys:', error);
    }
};
exports.cleanupExpiredKeys = cleanupExpiredKeys;
//# sourceMappingURL=redis.js.map
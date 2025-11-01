import { createClient } from 'redis';
import { REDIS_URL, REDIS_PASSWORD } from './environment';
import { logger } from '../utils/logger';

let redisClient: any = null;

export const connectToRedis = async () => {
  try {
    const options: any = {
      url: REDIS_URL,
    };
    if (REDIS_PASSWORD) {
      options.password = REDIS_PASSWORD;
    }
    redisClient = createClient(options);

    redisClient.on('error', (err: any) => {
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
  } catch (error) {
    console.error('Redis connection error:', error);
    throw error;
  }
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectToRedis first.');
  }
  return redisClient;
};

export const disconnectFromRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log('Disconnected from Redis');
  }
};

// Redis key prefixes for better organization
export const RedisKeys = {
  // Watch Together rooms
  rooms: 'room:',
  roomParticipants: 'room:participants:',
  roomState: 'room:state:',
  activeRooms: 'rooms:active',
  
  // Provider caching
  providerCache: 'provider:',
  providerHealth: 'provider:health:',
  
  // Proxy management
  proxyHealth: 'proxy:health:',
  proxyStats: 'proxy:stats:',
  
  // Rate limiting
  rateLimit: 'rate_limit:',
  
  // Sessions
  sessions: 'session:',
  
  // Cache
  cache: 'cache:',
} as const;

// Helper functions for Redis operations
export const setRoom = async (roomId: string, roomData: any) => {
  const client = getRedisClient();
  const key = `${RedisKeys.rooms}${roomId}`;
  await client.setEx(key, 3600, JSON.stringify(roomData)); // 1 hour TTL
};

export const getRoom = async (roomId: string) => {
  const client = getRedisClient();
  const key = `${RedisKeys.rooms}${roomId}`;
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
};

export const deleteRoom = async (roomId: string) => {
  const client = getRedisClient();
  const key = `${RedisKeys.rooms}${roomId}`;
  await client.del(key);
};

export const addRoomParticipant = async (roomId: string, userId: string) => {
  const client = getRedisClient();
  const key = `${RedisKeys.roomParticipants}${roomId}`;
  await client.sAdd(key, userId);
  await client.expire(key, 3600); // 1 hour TTL
};

export const removeRoomParticipant = async (roomId: string, userId: string) => {
  const client = getRedisClient();
  const key = `${RedisKeys.roomParticipants}${roomId}`;
  await client.sRem(key, userId);
};

export const getRoomParticipants = async (roomId: string) => {
  const client = getRedisClient();
  const key = `${RedisKeys.roomParticipants}${roomId}`;
  return await client.sMembers(key);
};

export const setRoomState = async (roomId: string, state: any) => {
  const client = getRedisClient();
  const key = `${RedisKeys.roomState}${roomId}`;
  await client.setEx(key, 3600, JSON.stringify(state)); // 1 hour TTL
};

export const getRoomState = async (roomId: string) => {
  const client = getRedisClient();
  const key = `${RedisKeys.roomState}${roomId}`;
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
};

export const setProviderCache = async (provider: string, key: string, data: any, ttl: number = 21600) => {
  const client = getRedisClient();
  const cacheKey = `${RedisKeys.providerCache}${provider}:${key}`;
  await client.setEx(cacheKey, ttl, JSON.stringify(data));
};

export const getProviderCache = async (provider: string, key: string) => {
  const client = getRedisClient();
  const cacheKey = `${RedisKeys.providerCache}${provider}:${key}`;
  const data = await client.get(cacheKey);
  return data ? JSON.parse(data) : null;
};

export const setProxyHealth = async (proxyUrl: string, isHealthy: boolean) => {
  const client = getRedisClient();
  const key = `${RedisKeys.proxyHealth}${proxyUrl}`;
  await client.setEx(key, 3600, isHealthy.toString()); // 1 hour TTL
};

export const getProxyHealth = async (proxyUrl: string) => {
  const client = getRedisClient();
  const key = `${RedisKeys.proxyHealth}${proxyUrl}`;
  const data = await client.get(key);
  return data === 'true';
};

export const incrementRateLimit = async (key: string, windowMs: number) => {
  const client = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowMs;
  
  await client.zRemRangeByScore(key, 0, windowStart);
  await client.zAdd(key, [{ score: now, value: now.toString() }]);
  await client.expire(key, Math.ceil(windowMs / 1000));
  
  const currentCount = await client.zCard(key);
  return currentCount;
};

export const getRateLimitCount = async (key: string) => {
  const client = getRedisClient();
  return await client.zCard(key);
};

export const cleanupExpiredKeys = async () => {
  const client = getRedisClient();
  const patterns = [
    `${RedisKeys.rooms}*`,
    `${RedisKeys.roomParticipants}*`,
    `${RedisKeys.roomState}*`,
    `${RedisKeys.providerCache}*`,
    `${RedisKeys.proxyHealth}*`,
  ];
  
  try {
    for (const pattern of patterns) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
        console.log(`Cleaned up ${keys.length} expired keys for pattern: ${pattern}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up expired keys:', error);
  }
};

export const renewRoomTTL = async (roomId: string, ttl: number = 3600) => {
  const client = getRedisClient();
  const roomKey = `${RedisKeys.rooms}${roomId}`;
  const participantsKey = `${RedisKeys.roomParticipants}${roomId}`;
  const stateKey = `${RedisKeys.roomState}${roomId}`;
  
  try {
    // Use Redis transaction to ensure all TTLs are updated atomically
    const multi = client.multi();
    multi.expire(roomKey, ttl);
    multi.expire(participantsKey, ttl);
    multi.expire(stateKey, ttl);
    await multi.exec();
    
    logger.info(`Renewed TTL for room ${roomId}`);
  } catch (error) {
    logger.error(`Error renewing TTL for room ${roomId}:`, error);
    throw error;
  }
};

// Optimized batch operations for better performance
export const batchRenewRoomTTLs = async (roomIds: string[], ttl: number = 3600) => {
  const client = getRedisClient();
  
  try {
    const multi = client.multi();
    
    for (const roomId of roomIds) {
      multi.expire(`${RedisKeys.rooms}${roomId}`, ttl);
      multi.expire(`${RedisKeys.roomParticipants}${roomId}`, ttl);
      multi.expire(`${RedisKeys.roomState}${roomId}`, ttl);
    }
    
    await multi.exec();
    logger.info(`Renewed TTL for ${roomIds.length} rooms`);
  } catch (error) {
    logger.error(`Error batch renewing TTL for rooms:`, error);
    throw error;
  }
};

// Optimized cleanup for inactive rooms
export const cleanupInactiveRooms = async (inactivityThresholdMs: number = 300000) => { // 5 minutes
  const client = getRedisClient();
  const activeRooms = await getActiveRooms();
  let cleanedCount = 0;
  
  try {
    const now = Date.now();
    const roomsToClean: string[] = [];
    
    // Check each room for inactivity
    for (const roomId of activeRooms) {
      const participantsKey = `${RedisKeys.roomParticipants}${roomId}`;
      const participants = await client.hGetAll(participantsKey);
      
      let isInactive = true;
      for (const lastSeen of Object.values(participants)) {
        const lastSeenTime = parseInt(lastSeen as string);
        if (now - lastSeenTime < inactivityThresholdMs) {
          isInactive = false;
          break;
        }
      }
      
      if (isInactive) {
        roomsToClean.push(roomId);
      }
    }
    
    // Clean up inactive rooms in batch
    if (roomsToClean.length > 0) {
      const multi = client.multi();
      
      for (const roomId of roomsToClean) {
        multi.del(`${RedisKeys.rooms}${roomId}`);
        multi.del(`${RedisKeys.roomParticipants}${roomId}`);
        multi.del(`${RedisKeys.roomState}${roomId}`);
        multi.sRem(RedisKeys.activeRooms, roomId);
      }
      
      await multi.exec();
      cleanedCount = roomsToClean.length;
      logger.info(`Cleaned up ${cleanedCount} inactive rooms`);
    }
    
    return cleanedCount;
  } catch (error) {
    logger.error('Error cleaning up inactive rooms:', error);
    throw error;
  }
};

// Memory-efficient room listing with pagination
export const getRoomsWithPagination = async (page: number = 1, limit: number = 20) => {
  const client = getRedisClient();
  const activeRooms = await getActiveRooms();
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  try {
    const paginatedRoomIds = activeRooms.slice(startIndex, endIndex);
    const rooms = [];
    
    for (const roomId of paginatedRoomIds) {
      const roomData = await client.get(`${RedisKeys.rooms}${roomId}`);
      if (roomData) {
        rooms.push(JSON.parse(roomData));
      }
    }
    
    return {
      rooms,
      pagination: {
        page,
        limit,
        total: activeRooms.length,
        totalPages: Math.ceil(activeRooms.length / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting paginated rooms:', error);
    throw error;
  }
};

export const addRoomToActiveRooms = async (roomId: string) => {
  const client = getRedisClient();
  await client.sAdd(RedisKeys.activeRooms, roomId);
  await client.expire(RedisKeys.activeRooms, 86400); // 24 hour TTL for the active rooms set
};

export const removeRoomFromActiveRooms = async (roomId: string) => {
  const client = getRedisClient();
  await client.sRem(RedisKeys.activeRooms, roomId);
};

export const getActiveRooms = async () => {
  const client = getRedisClient();
  return await client.sMembers(RedisKeys.activeRooms);
};
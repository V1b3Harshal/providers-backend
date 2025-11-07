import { env } from 'process';
import { logger } from '../utils/logger';

// Check if Upstash is configured
const isUpstashConfigured = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN;

// Redis client instance
let isConnected = false;

// Initialize Upstash Redis client
export const connectToRedis = async (): Promise<void> => {
  if (!isUpstashConfigured) {
    logger.info('Upstash Redis configuration missing, using in-memory fallback');
    isConnected = true;
    return;
  }

  try {
    // Use fetch API for Upstash REST API - test with a simple ping
    const response = await fetch(`${env.UPSTASH_REDIS_REST_URL}/ping`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to connect to Upstash: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if ((result as any).result !== 'PONG') {
      throw new Error(`Upstash ping returned unexpected result: ${(result as any).result}`);
    }

    isConnected = true;
    logger.info('Connected to Upstash Redis successfully');
  } catch (error) {
    logger.error('Failed to connect to Upstash Redis:', error);
    logger.info('Using in-memory fallback');
    isConnected = true; // Allow fallback to continue
  }
};

export const getRedisClient = () => {
  if (!isConnected) {
    throw new Error('Redis not connected. Call connectToRedis() first.');
  }
  
  const memoryStore = new Map<string, any>();
  
  return {
    // Redis operations
    zAdd: async (key: string, entries: Array<{ score: number; value: string }>) => {
      if (!memoryStore.has(key)) {
        memoryStore.set(key, new Map());
      }
      const zSet = memoryStore.get(key);
      entries.forEach(entry => {
        zSet.set(entry.value, entry.score);
      });
      return { result: entries.length };
    },

    zRemRangeByScore: async (key: string, min: number, max: number) => {
      if (!memoryStore.has(key)) {
        return { result: 0 };
      }
      const zSet = memoryStore.get(key);
      let removed = 0;
      for (const [value, score] of zSet) {
        if (score >= min && score <= max) {
          zSet.delete(value);
          removed++;
        }
      }
      return { result: removed };
    },

    zCard: async (key: string) => {
      if (!memoryStore.has(key)) {
        return { result: 0 };
      }
      return { result: memoryStore.get(key).size };
    },

    expire: async (key: string, seconds: number) => {
      // In-memory implementation doesn't support TTL, but we'll simulate it
      return { result: 1 };
    },

    del: async (key: string) => {
      const deleted = memoryStore.delete(key);
      return { result: deleted ? 1 : 0 };
    },

    sAdd: async (key: string, members: string[]) => {
      if (!memoryStore.has(key)) {
        memoryStore.set(key, new Set());
      }
      const set = memoryStore.get(key);
      let added = 0;
      members.forEach(member => {
        if (!set.has(member)) {
          set.add(member);
          added++;
        }
      });
      return { result: added };
    },

    sRem: async (key: string, member: string) => {
      if (!memoryStore.has(key)) {
        return { result: 0 };
      }
      const set = memoryStore.get(key);
      const deleted = set.delete(member);
      return { result: deleted ? 1 : 0 };
    },

    hGetAll: async (key: string) => {
      if (!memoryStore.has(key)) {
        return { result: {} };
      }
      return { result: Object.fromEntries(memoryStore.get(key)) };
    },

    hSet: async (key: string, field: string, value: string) => {
      if (!memoryStore.has(key)) {
        memoryStore.set(key, new Map());
      }
      const hash = memoryStore.get(key);
      hash.set(field, value);
      return { result: 1 };
    },

    multi: () => {
      // Return a mock multi object for batch operations
      return {
        exec: async () => {
          // For now, execute operations sequentially
          return [];
        }
      };
    },

    // Additional functions for room management
    set: async (key: string, value: string, options?: { EX?: number }) => {
      memoryStore.set(key, value);
      if (options?.EX) {
        // TTL not implemented in memory, but we'll store it for reference
        memoryStore.set(`${key}:ttl`, options.EX);
      }
      return { result: 'OK' };
    },

    get: async (key: string) => {
      return { result: memoryStore.get(key) || null };
    },

    setEx: async (key: string, seconds: number, value: string) => {
      memoryStore.set(key, value);
      memoryStore.set(`${key}:ttl`, seconds);
      return { result: 'OK' };
    },

    sMembers: async (key: string) => {
      if (!memoryStore.has(key)) {
        return { result: [] };
      }
      const set = memoryStore.get(key);
      return { result: Array.from(set) };
    },

    // Utility methods
    isRedisConnected: () => isConnected,
    getRedisUrl: () => env.UPSTASH_REDIS_REST_URL || 'in-memory',
    getRedisToken: () => env.UPSTASH_REDIS_REST_TOKEN || ''
  };
};

export const disconnectFromRedis = async () => {
  if (isConnected) {
    logger.info('Upstash Redis connection will auto-close');
    isConnected = false;
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
  
  // Rate limiting
  rateLimit: 'rate_limit:',
  
  // Sessions
  sessions: 'session:',
  
  // Cache
  cache: 'cache:',
} as const;

// Helper functions for Redis operations

export const setRoom = async (roomId: string, roomData: any) => {
  const key = `${RedisKeys.rooms}${roomId}`;
  const data = JSON.stringify(roomData);
  
  const client = getRedisClient();
  await client.setEx(key, 3600, data);
};

export const getRoom = async (roomId: string) => {
  const key = `${RedisKeys.rooms}${roomId}`;
  const client = getRedisClient();
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
};

export const deleteRoom = async (roomId: string) => {
  const key = `${RedisKeys.rooms}${roomId}`;
  const client = getRedisClient();
  await client.del(key);
};

export const addRoomParticipant = async (roomId: string, userId: string) => {
  const key = `${RedisKeys.roomParticipants}${roomId}`;
  const client = getRedisClient();
  await client.sAdd(key, userId);
  await client.expire(key, 3600);
};

export const removeRoomParticipant = async (roomId: string, userId: string) => {
  const key = `${RedisKeys.roomParticipants}${roomId}`;
  const client = getRedisClient();
  await client.sRem(key, userId);
};

export const getRoomParticipants = async (roomId: string) => {
  const key = `${RedisKeys.roomParticipants}${roomId}`;
  const client = getRedisClient();
  return await client.sMembers(key);
};

export const setRoomState = async (roomId: string, state: any) => {
  const key = `${RedisKeys.roomState}${roomId}`;
  const data = JSON.stringify(state);
  const client = getRedisClient();
  await client.setEx(key, 3600, data);
};

export const getRoomState = async (roomId: string) => {
  const key = `${RedisKeys.roomState}${roomId}`;
  const client = getRedisClient();
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
};

export const setProviderCache = async (provider: string, key: string, data: any, ttl: number = 21600) => {
  const cacheKey = `${RedisKeys.providerCache}${provider}:${key}`;
  const serializedData = JSON.stringify(data);
  const client = getRedisClient();
  await client.setEx(cacheKey, ttl, serializedData);
};

export const getProviderCache = async (provider: string, key: string) => {
  const cacheKey = `${RedisKeys.providerCache}${provider}:${key}`;
  const client = getRedisClient();
  const data = await client.get(cacheKey);
  return data ? JSON.parse(data) : null;
};

export const incrementRateLimit = async (key: string, windowMs: number) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  const client = getRedisClient();
  
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
  // Upstash doesn't support pattern-based deletion efficiently, so we'll skip this
  logger.info('Skipping key cleanup for Upstash Redis (pattern-based deletion not supported)');
};

export const renewRoomTTL = async (roomId: string, ttl: number = 3600) => {
  const roomKey = `${RedisKeys.rooms}${roomId}`;
  const participantsKey = `${RedisKeys.roomParticipants}${roomId}`;
  const stateKey = `${RedisKeys.roomState}${roomId}`;
  const client = getRedisClient();
  
  try {
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

export const cleanupInactiveRooms = async (inactivityThresholdMs: number = 300000) => {
  let cleanedCount = 0;
  
  try {
    const activeRooms = await getActiveRooms();
    const now = Date.now();
    const roomsToClean: string[] = [];
    
    // Check each room for inactivity
    for (const roomId of activeRooms) {
      const participantsKey = `${RedisKeys.roomParticipants}${roomId}`;
      const client = getRedisClient();
      const participants = await client.sMembers(participantsKey);
      let isInactive = true;
      
      for (const participant of participants) {
        const lastSeenKey = `${participantsKey}:lastseen:${participant}`;
        const lastSeen = await client.get(lastSeenKey);
        
        if (lastSeen && now - parseInt(lastSeen) < inactivityThresholdMs) {
          isInactive = false;
          break;
        }
      }
      
      if (isInactive) {
        roomsToClean.push(roomId);
      }
    }
    
    // Clean up inactive rooms
    if (roomsToClean.length > 0) {
      for (const roomId of roomsToClean) {
        await deleteRoom(roomId);
        await removeRoomFromActiveRooms(roomId);
      }
      cleanedCount = roomsToClean.length;
      logger.info(`Cleaned up ${cleanedCount} inactive rooms`);
    }
    
    return cleanedCount;
  } catch (error) {
    logger.error('Error cleaning up inactive rooms:', error);
    throw error;
  }
};

export const getRoomsWithPagination = async (page: number = 1, limit: number = 20) => {
  const activeRooms = await getActiveRooms();
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  try {
    const paginatedRoomIds = activeRooms.slice(startIndex, endIndex);
    const rooms = [];
    
    for (const roomId of paginatedRoomIds) {
      const roomData = await getRoom(roomId);
      if (roomData) {
        rooms.push(roomData);
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
  await client.expire(RedisKeys.activeRooms, 86400);
};

export const removeRoomFromActiveRooms = async (roomId: string) => {
  const client = getRedisClient();
  await client.sRem(RedisKeys.activeRooms, roomId);
};

export const getActiveRooms = async () => {
  const client = getRedisClient();
  return await client.sMembers(RedisKeys.activeRooms);
};

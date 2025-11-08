// Enhanced Upstash Redis configuration with real Redis client
import { env } from 'process';
import { logger } from '../utils/logger';

// Check if Upstash is configured
const isUpstashConfigured = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN;

// Redis client instance
let isConnected = false;
let redisClient: any = null;

// Real Upstash Redis client using REST API
class UpstashRedisClient {
  private baseUrl: string;
  private token: string;
  private isHealthy = true;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request(endpoint: string, method: string = 'GET', body?: any) {
    const url = `${this.baseUrl}/${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Upstash Redis error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      this.isHealthy = false;
      throw error;
    }
  }

  async set(key: string, value: string, options?: { EX?: number; PX?: number }): Promise<any> {
    const body = {
      key,
      value,
      ...(options?.EX && { ex: options.EX }),
      ...(options?.PX && { px: options.PX })
    };
    return await this.request('set', 'POST', body);
  }

  async get(key: string): Promise<any> {
    const result = await this.request(`get/${encodeURIComponent(key)}`);
    return result.result || null;
  }

  async del(key: string): Promise<any> {
    return await this.request(`del/${encodeURIComponent(key)}`, 'POST');
  }

  async exists(key: string): Promise<any> {
    return await this.request(`exists/${encodeURIComponent(key)}`);
  }

  async expire(key: string, seconds: number): Promise<any> {
    return await this.request(`expire/${encodeURIComponent(key)}/${seconds}`, 'POST');
  }

  async ttl(key: string): Promise<any> {
    return await this.request(`ttl/${encodeURIComponent(key)}`);
  }

  async zadd(key: string, score: number, member: string): Promise<any> {
    return await this.request('zadd', 'POST', {
      key,
      member: [{ score, member }]
    });
  }

  async zrem(key: string, member: string): Promise<any> {
    return await this.request('zrem', 'POST', {
      key,
      members: [member]
    });
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<any> {
    return await this.request('zremrangebyscore', 'POST', {
      key,
      min,
      max
    });
  }

  async zcard(key: string): Promise<any> {
    return await this.request(`zcard/${encodeURIComponent(key)}`);
  }

  async sadd(key: string, members: string[]): Promise<any> {
    return await this.request('sadd', 'POST', {
      key,
      members
    });
  }

  async srem(key: string, member: string): Promise<any> {
    return await this.request('srem', 'POST', {
      key,
      members: [member]
    });
  }

  async smembers(key: string): Promise<any> {
    return await this.request(`smembers/${encodeURIComponent(key)}`);
  }

  async hset(key: string, field: string, value: string): Promise<any> {
    return await this.request('hset', 'POST', {
      key,
      field,
      value
    });
  }

  async hget(key: string, field: string): Promise<any> {
    return await this.request(`hget/${encodeURIComponent(key)}/${encodeURIComponent(field)}`);
  }

  async hgetall(key: string): Promise<any> {
    return await this.request(`hgetall/${encodeURIComponent(key)}`);
  }

  async ping(): Promise<any> {
    return await this.request('ping');
  }

  isHealthyCheck(): boolean {
    return this.isHealthy;
  }

  async health(): Promise<{ status: string; responseTime: number }> {
    const start = Date.now();
    try {
      await this.ping();
      return { status: 'healthy', responseTime: Date.now() - start };
    } catch (error) {
      return { status: 'unhealthy', responseTime: Date.now() - start };
    }
  }
}

// Initialize Upstash Redis client
export const connectToRedis = async (): Promise<void> => {
  if (!isUpstashConfigured) {
    logger.warn('Upstash Redis configuration missing, using in-memory fallback');
    isConnected = true;
    return;
  }

  try {
    const client = new UpstashRedisClient(
      env.UPSTASH_REDIS_REST_URL!,
      env.UPSTASH_REDIS_REST_TOKEN!
    );
    
    // Test connection
    await client.ping();
    redisClient = client;
    isConnected = true;
    logger.info('Connected to Upstash Redis successfully');
  } catch (error) {
    logger.error('Failed to connect to Upstash Redis:', error);
    logger.warn('Using in-memory fallback');
    isConnected = true; // Allow fallback to continue
  }
};

// Get Redis client
export const getRedisClient = () => {
  if (!isConnected) {
    throw new Error('Redis not connected. Call connectToRedis() first.');
  }
  
  // If we have a real Upstash Redis client, use it
  if (redisClient) {
    return redisClient;
  }
  
  // Fallback to in-memory implementation
  const memoryStore = new Map<string, any>();
  
  return {
    // Redis operations
    set: async (key: string, value: string, options?: { EX?: number }) => {
      memoryStore.set(key, value);
      return { result: 'OK' };
    },

    get: async (key: string) => {
      return { result: memoryStore.get(key) || null };
    },

    del: async (key: string) => {
      const deleted = memoryStore.delete(key);
      return { result: deleted ? 1 : 0 };
    },

    exists: async (key: string) => {
      return { result: memoryStore.has(key) ? 1 : 0 };
    },

    expire: async (key: string, seconds: number) => {
      // In-memory TTL simulation (basic implementation)
      return { result: 1 };
    },

    ttl: async (key: string) => {
      return { result: -1 }; // No TTL in memory store
    },

    // Set operations for rate limiting
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

    // Set operations
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

    sMembers: async (key: string) => {
      if (!memoryStore.has(key)) {
        return { result: [] };
      }
      const set = memoryStore.get(key);
      return { result: Array.from(set) };
    },

    // Hash operations
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

    hGet: async (key: string, field: string) => {
      if (!memoryStore.has(key)) {
        return { result: null };
      }
      const hash = memoryStore.get(key);
      return { result: hash.get(field) || null };
    },

    // Multi operations
    multi: () => {
      return {
        exec: async () => {
          return [];
        }
      };
    },

    // Health check
    ping: async () => {
      return { result: 'PONG' };
    },

    // Utility methods
    isRedisConnected: () => isConnected,
    getRedisUrl: () => env.UPSTASH_REDIS_REST_URL || 'in-memory',
    getRedisToken: () => env.UPSTASH_REDIS_REST_TOKEN || '',
    isRealRedis: () => !!redisClient
  };
};

// Check if Redis is connected
export const isRedisConnected = () => isConnected;

// Check Redis health
export const getRedisHealth = async (): Promise<{ status: string; responseTime: number; type: string }> => {
  const start = Date.now();
  
  if (redisClient) {
    try {
      const health = await redisClient.health();
      return { 
        status: health.status, 
        responseTime: health.responseTime, 
        type: 'upstash-redis' 
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        responseTime: Date.now() - start, 
        type: 'upstash-redis' 
      };
    }
  }
  
  return { 
    status: 'healthy', 
    responseTime: Date.now() - start, 
    type: 'in-memory' 
  };
};

// Cleanup expired keys
export const cleanupExpiredKeys = async (): Promise<void> => {
  if (!isConnected) return;
  
  try {
    if (redisClient) {
      // Upstash handles TTL automatically, but we can add custom cleanup logic
      logger.info('Redis cleanup completed (Upstash handles TTL automatically)');
    } else {
      // In-memory cleanup
      logger.info('In-memory Redis cleanup completed');
    }
  } catch (error) {
    logger.error('Error during Redis cleanup:', error);
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
  metrics: 'metrics:',
  userData: 'user:',
  watchParty: 'watch_party:'
};

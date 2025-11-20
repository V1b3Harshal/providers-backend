// Enhanced Upstash Redis configuration with real Redis client
import { env } from 'process';
import { logger } from '../utils/logger';
import { Room, RoomParticipant, RoomState } from '../types/index';

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
    return (result as any).result || null;
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

  async zadd(key: string, entries: Array<{ score: number; value: string }>): Promise<any> {
    return await this.request('zadd', 'POST', {
      key,
      member: entries.map(entry => ({ score: entry.score, member: entry.value }))
    });
  }

  async zrem(key: string, member: string): Promise<any> {
    return await this.request('zrem', 'POST', {
      key,
      members: [member]
    });
  }

  async zrange(key: string, min: number, max: number, options?: { REV?: boolean; WITHSCORES?: boolean }): Promise<any> {
    const params = [encodeURIComponent(key), min, max];
    if (options?.REV) params.push('REV');
    if (options?.WITHSCORES) params.push('WITHSCORES');
    return await this.request(`zrange/${params.join('/')}`);
  }

  async zcard(key: string): Promise<any> {
    return await this.request(`zcard/${encodeURIComponent(key)}`);
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

  async hdel(key: string, field: string): Promise<any> {
    return await this.request('hdel', 'POST', {
      key,
      fields: [field]
    });
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
    throw new Error('Upstash Redis configuration is required. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
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
    throw new Error('Unable to connect to Upstash Redis');
  }
};

// Get Redis client
export const getRedisClient = () => {
  if (!isConnected || !redisClient) {
    throw new Error('Upstash Redis not connected. Call connectToRedis() first.');
  }

  return redisClient;
};

// Check if Redis is connected
export const isRedisConnected = () => isConnected;

// Check Redis health
export const getRedisHealth = async (): Promise<{ status: string; responseTime: number; type: string }> => {
  const start = Date.now();

  if (!redisClient) {
    return {
      status: 'not_connected',
      responseTime: Date.now() - start,
      type: 'upstash-redis'
    };
  }

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
};

// Cleanup expired keys
export const cleanupExpiredKeys = async (): Promise<void> => {
  if (!isConnected) return;

  try {
    logger.info('Redis cleanup completed (Upstash handles TTL automatically)');
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

// =================================================================
// WATCH TOGETHER ROOM MANAGEMENT FUNCTIONS
// =================================================================

// Get room data
export const getRoom = async (roomId: string): Promise<Room | null> => {
  const client = getRedisClient();
  const key = `${RedisKeys.rooms}${roomId}`;
  const result = await client.get(key);
  if (!result?.result) return null;
  
  try {
    const roomData = JSON.parse(result.result);
    return {
      ...roomData,
      createdAt: new Date(roomData.createdAt),
      updatedAt: new Date(roomData.updatedAt),
      expiresAt: new Date(roomData.expiresAt)
    };
  } catch {
    return null;
  }
};

// Set room data
export const setRoom = async (roomIdOrRoom: string | Room, room?: Room): Promise<void> => {
  const client = getRedisClient();
  
  // Handle both function signatures
  let roomData: Room;
  let roomId: string;
  
  if (typeof roomIdOrRoom === 'string') {
    roomData = room!;
    roomId = roomIdOrRoom;
  } else {
    roomData = roomIdOrRoom;
    roomId = roomIdOrRoom.id;
  }
  
  const key = `${RedisKeys.rooms}${roomId}`;
  const ttl = Math.max(0, Math.floor((roomData.expiresAt.getTime() - Date.now()) / 1000));
  
  await client.set(key, JSON.stringify(roomData), { EX: ttl });
};

// Delete room data
export const deleteRoom = async (roomId: string): Promise<void> => {
  const client = getRedisClient();
  const key = `${RedisKeys.rooms}${roomId}`;
  await client.del(key);
  
  // Also remove from active rooms
  await removeRoomFromActiveRooms(roomId);
};

// Add room participant
export const addRoomParticipant = async (roomId: string, participant: RoomParticipant | string): Promise<void> => {
  const client = getRedisClient();
  const key = `${RedisKeys.roomParticipants}${roomId}`;
  
  if (typeof participant === 'string') {
    // Handle string userId by creating a basic participant
    const basicParticipant: RoomParticipant = {
      userId: participant,
      roomId,
      isHost: false,
      isOnline: true,
      joinedAt: new Date(),
      lastActivity: new Date()
    };
    await client.hset(key, participant, JSON.stringify({
      ...basicParticipant,
      joinedAt: basicParticipant.joinedAt.toISOString(),
      lastActivity: basicParticipant.lastActivity.toISOString()
    }));
  } else {
    await client.hset(key, participant.userId, JSON.stringify({
      ...participant,
      joinedAt: participant.joinedAt.toISOString(),
      lastActivity: participant.lastActivity.toISOString()
    }));
  }
  
  // Set TTL for participant data
  await client.expire(key, 3600); // 1 hour
};

// Remove room participant
export const removeRoomParticipant = async (roomId: string, userId: string): Promise<void> => {
  const client = getRedisClient();
  const key = `${RedisKeys.roomParticipants}${roomId}`;
  await client.hdel(key, userId);
};

// Get room participants
export const getRoomParticipants = async (roomId: string): Promise<RoomParticipant[]> => {
  const client = getRedisClient();
  const key = `${RedisKeys.roomParticipants}${roomId}`;
  const result = await client.hgetall(key);
  
  if (!result?.result) return [];
  
  return Object.entries(result.result).map(([userId, data]) => {
    const participantData = JSON.parse(data as string);
    return {
      userId,
      roomId,
      isHost: participantData.isHost,
      isOnline: participantData.isOnline,
      deviceInfo: participantData.deviceInfo,
      joinedAt: new Date(participantData.joinedAt),
      lastActivity: new Date(participantData.lastActivity)
    };
  });
};

// Set room state
export const setRoomState = async (roomState: RoomState | { roomId: string; currentVideo: any; playbackState: any; currentTime?: number; lastUpdate: Date }): Promise<void> => {
  const client = getRedisClient();
  const roomId = typeof roomState === 'string' ? roomState : roomState.roomId;
  const key = `${RedisKeys.roomState}${roomId}`;
  
  const stateData = typeof roomState === 'string' ? { 
    roomId, 
    currentVideo: { id: '', title: '', provider: '', timestamp: 0, duration: 0 },
    playbackState: { isPlaying: false, currentTime: 0, volume: 1 },
    lastUpdate: new Date()
  } : {
    ...roomState,
    lastUpdate: roomState.lastUpdate.toISOString()
  };
  
  await client.set(key, JSON.stringify(stateData));
  
  // Set TTL
  await client.expire(key, 3600); // 1 hour
};

// Get room state
export const getRoomState = async (roomId: string): Promise<RoomState | null> => {
  const client = getRedisClient();
  const key = `${RedisKeys.roomState}${roomId}`;
  const result = await client.get(key);
  
  if (!result?.result) return null;
  
  try {
    const stateData = JSON.parse(result.result);
    return {
      ...stateData,
      lastUpdate: new Date(stateData.lastUpdate)
    };
  } catch {
    return null;
  }
};

// Get active rooms
export const getActiveRooms = async (): Promise<string[]> => {
  const client = getRedisClient();
  const key = RedisKeys.activeRooms;
  const result = await client.zrange(key, 0, -1, { REV: true, WITHSCORES: false });
  
  return (result as any)?.result || [];
};

// Add room to active rooms
export const addRoomToActiveRooms = async (roomId: string): Promise<void> => {
  const client = getRedisClient();
  const key = RedisKeys.activeRooms;
  const score = Date.now();

  await client.zadd(key, [{ score, value: roomId }]);
};

// Remove room from active rooms
export const removeRoomFromActiveRooms = async (roomId: string): Promise<void> => {
  const client = getRedisClient();
  const key = RedisKeys.activeRooms;
  await client.zrem(key, roomId);
};

// Renew room TTL
export const renewRoomTTL = async (roomId: string, newExpiryTime?: Date): Promise<void> => {
  const client = getRedisClient();
  const key = `${RedisKeys.rooms}${roomId}`;
  
  const ttl = newExpiryTime ? 
    Math.max(0, Math.floor((newExpiryTime.getTime() - Date.now()) / 1000)) :
    3600; // Default 1 hour
  
  await client.expire(key, ttl);
};

// Batch renew room TTLs
export const batchRenewRoomTTLs = async (rooms: Array<{ id: string; expiresAt: Date }>, ttl?: number): Promise<void> => {
  for (const room of rooms) {
    if (ttl) {
      await renewRoomTTL(room.id, new Date(Date.now() + ttl * 1000));
    } else {
      await renewRoomTTL(room.id, room.expiresAt);
    }
  }
};

// Cleanup inactive rooms
export const cleanupInactiveRooms = async (): Promise<{ cleaned: number }> => {
  const client = getRedisClient();
  const activeRooms = await getActiveRooms();
  
  let cleaned = 0;
  const cutoffTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
  
  for (const roomId of activeRooms) {
    const room = await getRoom(roomId);
    if (room && room.updatedAt.getTime() < cutoffTime) {
      await deleteRoom(roomId);
      cleaned++;
    }
  }
  
  return { cleaned };
};

// Get rooms with pagination
export const getRoomsWithPagination = async (page: number, limit: number): Promise<{
  rooms: Room[];
  total: number;
  hasNext: boolean;
  hasPrevious: boolean;
}> => {
  const client = getRedisClient();
  const activeRooms = await getActiveRooms();
  
  // Get room details
  const rooms: Room[] = [];
  for (const roomId of activeRooms) {
    const room = await getRoom(roomId);
    if (room) {
      rooms.push(room);
    }
  }
  
  // Sort by creation date (newest first)
  rooms.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  // Paginate
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedRooms = rooms.slice(start, end);
  
  return {
    rooms: paginatedRooms,
    total: rooms.length,
    hasNext: end < rooms.length,
    hasPrevious: page > 1
  };
};

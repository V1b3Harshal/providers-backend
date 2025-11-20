import { Server, Socket } from 'socket.io';
import { WatchTogetherRoom, PlaybackAction, RoomEvent } from '../types';
import {
  setRoom,
  getRoom,
  deleteRoom,
  addRoomParticipant,
  removeRoomParticipant,
  getRoomParticipants,
  setRoomState,
  getRoomState,
  getRedisClient,
  RedisKeys,
  getActiveRooms,
  addRoomToActiveRooms,
  removeRoomFromActiveRooms,
  renewRoomTTL
} from '../config/redis';
import {
  batchRenewRoomTTLs,
  cleanupInactiveRooms,
  getRoomsWithPagination
} from '../config/redis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { validateSupabaseToken } from '../config/supabase';
import { notificationService } from './notificationService';
import { trackWatchTogetherEvent, trackWebSocketConnection, trackError, trackUserAction } from '../config/posthog';
import * as Sentry from '@sentry/node';

export class WatchTogetherService {
  private io: Server;
  private rooms: Map<string, WatchTogetherRoom> = new Map();
  private readonly MAX_PARTICIPANTS = 10;
  private readonly ROOM_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(io: Server) {
    this.io = io;
    this.setupSocketHandlers();
    this.startCleanupInterval();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`User connected: ${socket.id}`);

      // Track WebSocket connection
      trackWebSocketConnection('connected').catch(error => {
        logger.warn('Failed to track WebSocket connection:', error);
      });

      // Supabase WebSocket authentication
      socket.on('authenticate', async (data: { token: string }, callback: any) => {
        try {
          const user = await validateSupabaseToken(data.token);
          socket.data.userId = user.id;
          socket.data.isAdmin = false; // Default to false, can be enhanced later
          logger.info(`User ${user.id} authenticated for WebSocket via Supabase`);

          // Track successful authentication
          await trackUserAction('websocket_authenticated', user.id, {
            socketId: socket.id,
            timestamp: new Date().toISOString()
          });

          callback({ success: true, isAdmin: false });
        } catch (error) {
          logger.error('WebSocket authentication failed:', error);

          // Track authentication failure
          await trackError('WebSocket authentication failed', 'websocket_auth', undefined, {
            socketId: socket.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          // Send error to Sentry
          Sentry.captureException(error, {
            tags: {
              service: 'providers-backend',
              event: 'websocket_auth_failed'
            },
            extra: {
              socketId: socket.id
            }
          });

          callback({ success: false, error: 'Authentication failed' });
        }
      });

      socket.on('create_room', async (data, callback) => {
        try {
          const { name, mediaId, mediaType, providerId, token, isPublic = true, maxParticipants = 10 } = data;

          // Verify Supabase token
          const user = await validateSupabaseToken(token);
          const adminId = user.id;
          
          const roomId = uuidv4();
          const shareableLink = isPublic ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/watch-together/${roomId}` : null;
          
          const room: WatchTogetherRoom = {
            id: roomId,
            name,
            hostId: adminId,
            adminId,
            mediaId,
            mediaType,
            providerId: providerId || 'vidnest',
            participants: [adminId],
            currentState: {
              playbackState: {
                isPlaying: false,
                currentTime: 0,
                volume: 1
              },
              timestamp: Date.now()
            },
            isPublic,
            ...(shareableLink && { shareableLink }),
            maxParticipants,
            settings: {
              autoPlay: true,
              allowChat: true,
              maxParticipants: maxParticipants
            },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            createdAt: new Date(),
            updatedAt: new Date()
          };

          // Use atomic operations to create room and add to active rooms set
          const client = getRedisClient();
          const multi = client.multi();
          
          // Set room data
          multi.setEx(`${RedisKeys.rooms}${roomId}`, 3600, JSON.stringify(room));
          
          // Add admin as participant (only once)
          multi.sAdd(`${RedisKeys.roomParticipants}${roomId}`, adminId);
          multi.expire(`${RedisKeys.roomParticipants}${roomId}`, 3600);
          
          // Set initial room state
          multi.setEx(`${RedisKeys.roomState}${roomId}`, 3600, JSON.stringify(room.currentState));
          
          // Add room to active rooms set
          multi.sAdd(RedisKeys.activeRooms, roomId);
          multi.expire(RedisKeys.activeRooms, 86400);
          
          await multi.exec();

          socket.join(roomId);
          socket.data.roomId = roomId;
          socket.data.userId = adminId;
          socket.data.isAdmin = true;

          // Track room creation
          await trackWatchTogetherEvent('room_created', roomId, adminId, {
            providerId,
            mediaType,
            isPublic,
            maxParticipants
          });

          this.io.to(roomId).emit('room_created', room);
          callback({ success: true, roomId, room, shareableLink });
        } catch (error) {
          logger.error('Error creating room:', error);

          // Track room creation error
          await trackError('Failed to create room', 'create_room', undefined, {
            mediaId: data.mediaId,
            mediaType: data.mediaType,
            providerId: data.providerId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          // Send error to Sentry
          Sentry.captureException(error, {
            tags: {
              service: 'providers-backend',
              event: 'room_creation_failed'
            },
            extra: {
              mediaId: data.mediaId,
              mediaType: data.mediaType,
              providerId: data.providerId
            }
          });

          callback({ success: false, error: 'Failed to create room' });
        }
      });

      socket.on('join_room', async (data, callback) => {
        try {
          const { roomId, token, shareableLink } = data;

          // Verify Supabase token
          const user = await validateSupabaseToken(token);
          const userId = user.id;

          const room = await getRoom(roomId);
          
          // Validate shareable link if provided
          if (shareableLink && room?.shareableLink !== shareableLink) {
            callback({ success: false, error: 'Invalid shareable link' });
            return;
          }
          if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
          }

          if (room.participants.includes(userId)) {
            callback({ success: false, error: 'Already in room' });
            return;
          }

          if (room.participants.length >= (room.maxParticipants || 10)) {
            callback({ success: false, error: 'Room is full' });
            return;
          }

          await addRoomParticipant(roomId, userId);
          room.participants.push(userId);
          
          socket.join(roomId);
          socket.data.roomId = roomId;
          socket.data.userId = userId;
          socket.data.isAdmin = false;

          // Send current state to new user
          const currentState = await getRoomState(roomId);
          socket.emit('initial_state', {
            currentState: currentState || room.currentState,
            participants: room.participants,
            isAdmin: false
          });

          this.io.to(roomId).emit('user_joined', {
            userId,
            participants: room.participants,
            isAdmin: false
          });

          // Track user joining room
          await trackWatchTogetherEvent('user_joined', roomId, userId, {
            participantCount: room.participants.length,
            maxParticipants: room.maxParticipants
          });

          // Send push notification to other participants
          notificationService.notifyUserJoinedRoom(roomId, userId, 'User', room.participants.filter(id => id !== userId));

          callback({ success: true, room });
        } catch (error) {
          logger.error('Error joining room:', error);
          callback({ success: false, error: 'Failed to join room' });
        }
      });

      socket.on('leave_room', async (data, callback) => {
        try {
          const { roomId } = data;
          const userId = socket.data.userId;
          
          const room = await getRoom(roomId as string);
          if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
          }

          await removeRoomParticipant(roomId, userId);
          room.participants = room.participants.filter((id: string) => id !== userId);
          
          socket.leave(roomId);
          delete socket.data.roomId;
          delete socket.data.userId;

          // If admin leaves, transfer admin to another participant
          if (room.adminId === userId && room.participants.length > 0) {
            const newAdmin = room.participants[0];
            (room as any).adminId = newAdmin;
            
            this.io.to(roomId).emit('admin_changed', {
              newAdmin,
              oldAdmin: userId,
              participants: room.participants
            });
          }

          if (room.participants.length === 0) {
            // Use atomic operations to clean up room
            const client = getRedisClient();
            const multi = client.multi();
            
            multi.del(`${RedisKeys.rooms}${roomId}`);
            multi.del(`${RedisKeys.roomParticipants}${roomId}`);
            multi.del(`${RedisKeys.roomState}${roomId}`);
            multi.sRem(RedisKeys.activeRooms, roomId);
            
            await multi.exec();
            this.io.to(roomId).emit('room_deleted', { roomId });
          } else {
            this.io.to(roomId).emit('user_left', { userId, participants: room.participants });
          }

          callback({ success: true });
        } catch (error) {
          logger.error('Error leaving room:', error);
          callback({ success: false, error: 'Failed to leave room' });
        }
      });

      socket.on('playback_action', async (data) => {
        try {
          const { roomId, action, timestamp } = data;
          const userId = socket.data.userId;
          const isAdmin = socket.data.isAdmin;
          
          const room = await getRoom(roomId);
          if (!room) {
            logger.error('Room not found for playback action');
            return;
          }

          // Check if user is authenticated and has permission
          if (!isAdmin && room.adminId !== userId) {
            socket.emit('error', { message: 'Only admin can perform this action' });
            return;
          }

          // Prevent outdated actions from being processed
          const actionTime = new Date(timestamp);
          const roomTime = new Date(room.updatedAt);
          if (actionTime < roomTime) {
            logger.warn(`Received outdated action from user ${userId} in room ${roomId}`);
            return;
          }

          let stateUpdate: any = {};
          let broadcastEvent = 'playback_updated';
          
          switch (action.type) {
            case 'play':
              stateUpdate.isPlaying = true;
              break;
            case 'pause':
              stateUpdate.isPlaying = false;
              break;
            case 'seek':
            case 'updateTime':
              stateUpdate.currentTime = action.data.currentTime;
              break;
            case 'setPlaybackRate':
              stateUpdate.playbackRate = action.data.rate;
              break;
            case 'changeEpisode':
              stateUpdate.currentEpisode = action.data.episode || 1;
              stateUpdate.currentTime = 0;
              broadcastEvent = 'episode_changed';
              break;
            case 'changeProvider':
              stateUpdate.providerUrl = this.generateProviderUrl(action.data.provider, room.mediaId || '');
              stateUpdate.currentTime = 0;
              broadcastEvent = 'provider_changed';
              break;
            case 'changeMedia':
              stateUpdate.mediaId = action.data.mediaId;
              stateUpdate.currentEpisode = 1;
              stateUpdate.currentTime = 0;
              stateUpdate.providerUrl = this.generateProviderUrl(room.providerId || '', action.data.mediaId || '');
              broadcastEvent = 'media_changed';
              break;
            case 'fastForward':
            case 'rewind':
              const currentTime = room.currentState?.playbackState?.currentTime || 0;
              const skipAmount = action.data.skipAmount || 120;
              const newTime = action.type === 'fastForward' ?
                currentTime + skipAmount :
                Math.max(0, currentTime - skipAmount);
              
              stateUpdate.currentTime = newTime;
              broadcastEvent = 'time_skipped';
              break;
          }

          room.currentState = { ...room.currentState, ...stateUpdate };
          room.updatedAt = new Date();

          await setRoom(room);
          await setRoomState({
            roomId,
            currentVideo: room.currentVideo || {
              id: '',
              title: '',
              provider: '',
              timestamp: Date.now(),
              duration: 0
            },
            playbackState: room.currentState?.playbackState || { isPlaying: false, currentTime: 0, volume: 1 },
            lastUpdate: new Date()
          });

          this.io.to(roomId).emit(broadcastEvent, {
            action,
            state: room.currentState,
            userId,
            isAdmin: isAdmin || false,
            timestamp: room.updatedAt,
            roomId
          });

          // Send push notification for admin actions
          if (isAdmin) {
            notificationService.notifyAdminAction(roomId, 'Admin', action.type, room.participants);
          }

          logger.info(`Admin ${userId} performed ${action.type} action in room ${roomId}`);
        } catch (error) {
          logger.error('Error handling playback action:', error);
        }
      });

      socket.on('sync_request', async (data) => {
        try {
          const { roomId } = data;
          const userId = socket.data.userId;
          
          const room = await getRoom(roomId);
          if (!room) {
            logger.error('Room not found for sync request');
            return;
          }

          const currentState = await getRoomState(roomId);
          
          socket.emit('sync_response', {
            currentState: currentState || room.currentState,
            timestamp: room.updatedAt,
            adminId: room.adminId
          });
        } catch (error) {
          logger.error('Error handling sync request:', error);
        }
      });

      socket.on('heartbeat', async (data) => {
        try {
          const { roomId } = data;
          const userId = socket.data.userId;
          if (roomId && userId) {
            // Update user activity timestamp and renew TTL
            await addRoomParticipant(roomId, userId);
            await renewRoomTTL(roomId);
            
            // Update user's last seen time
            const client = getRedisClient();
            await client.hSet(`${RedisKeys.roomParticipants}${roomId}`, userId, Date.now().toString());
          }
        } catch (error) {
          logger.error('Error handling heartbeat:', error);
        }
      });

      socket.on('get_user_status', async (data) => {
        try {
          const { roomId } = data;
          const client = getRedisClient();
          const participants = await client.hGetAll(`${RedisKeys.roomParticipants}${roomId}`);
          
          const userStatus: { [userId: string]: { lastSeen: number; isActive: boolean } } = {};
          
          for (const [userId, lastSeen] of Object.entries(participants)) {
            const lastSeenTime = parseInt(lastSeen as string);
            userStatus[userId] = {
              lastSeen: lastSeenTime,
              isActive: Date.now() - lastSeenTime < 30000 // Active if seen in last 30 seconds
            };
          }
          
          socket.emit('user_status', userStatus);
        } catch (error) {
          logger.error('Error getting user status:', error);
        }
      });

      socket.on('request_invite', async (data, callback) => {
        try {
          const { roomId, targetUserId } = data;
          const requestingUserId = socket.data.userId;
          const isAdmin = socket.data.isAdmin;
          
          const room = await getRoom(roomId);
          if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
          }

          // Only admin can send invites
          if (!isAdmin && room.adminId !== requestingUserId) {
            callback({ success: false, error: 'Only admin can send invites' });
            return;
          }

          // Check if target user is already in the room
          if (room.participants.includes(targetUserId)) {
            callback({ success: false, error: 'User already in room' });
            return;
          }

          // Check if room has space
          if (room.participants.length >= (room.maxParticipants || 10)) {
            callback({ success: false, error: 'Room is full' });
            return;
          }

          // Send invite to target user (this would need to be implemented with user notifications)
          this.io.to(targetUserId).emit('room_invite', {
            roomId,
            roomName: room.name,
            fromUserId: requestingUserId,
            shareableLink: room.shareableLink,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
          });

          callback({ success: true, message: 'Invite sent successfully' });
        } catch (error) {
          logger.error('Error sending invite:', error);
          callback({ success: false, error: 'Failed to send invite' });
        }
      });

      socket.on('disconnect', async () => {
        try {
          if (socket.data.roomId && socket.data.userId) {
            const { roomId, userId } = socket.data;
            
            const room = await getRoom(roomId as string);
            if (room) {
              await removeRoomParticipant(roomId, userId);
              room.participants = room.participants.filter((id: string) => id !== userId);
              
              // If admin leaves, end the session
              if (room.adminId === userId) {
                logger.info(`Admin ${userId} disconnected from room ${roomId}, ending session`);
                
                // Notify all participants that session is ending
                this.io.to(roomId).emit('session_ended', {
                  reason: 'admin_disconnected',
                  timestamp: new Date(),
                  endedBy: userId
                });
                
                // Clean up room using atomic operations
                const client = getRedisClient();
                const multi = client.multi();
                
                multi.del(`${RedisKeys.rooms}${roomId}`);
                multi.del(`${RedisKeys.roomParticipants}${roomId}`);
                multi.del(`${RedisKeys.roomState}${roomId}`);
                multi.sRem(RedisKeys.activeRooms, roomId);
                
                await multi.exec();
              } else {
                // If regular user leaves, notify remaining participants
                this.io.to(roomId).emit('user_left', { userId, participants: room.participants });
 
                // Send push notification to remaining participants
                notificationService.notifyUserLeftRoom(roomId, userId, 'User', room.participants);
              }
            }
          }
        } catch (error) {
          logger.error('Error handling disconnect:', error);
        }
      });

    });
  }

  private generateProviderUrl(providerId: string, mediaId: string): string {
    const baseUrl = providerId === 'vidnest' ? 'https://vidnest.fun' :
                   providerId === 'vidsrc' ? 'https://vidsrc.to' :
                   'https://embed.stream';
    
    return `${baseUrl}/movie/${mediaId}`;
  }

  private startCleanupInterval(): void {
    setInterval(async () => {
      try {
        // Use optimized cleanup for inactive rooms first
        const cleanedInactive = await cleanupInactiveRooms();
        if (cleanedInactive.cleaned > 0) {
          logger.info(`Cleaned up ${cleanedInactive} inactive rooms`);
        }
        
        // Fall back to traditional cleanup for empty rooms
        const cleanedEmpty = await this.cleanupEmptyRooms();
        if (cleanedEmpty > 0) {
          logger.info(`Cleaned up ${cleanedEmpty} empty rooms`);
        }
      } catch (error) {
        logger.error('Error during room cleanup:', error);
      }
    }, this.ROOM_CLEANUP_INTERVAL);
  }

  async getRoom(roomId: string): Promise<WatchTogetherRoom | null> {
    return await getRoom(roomId) as WatchTogetherRoom;
  }

  async getRoomParticipants(roomId: string): Promise<string[]> {
    return (await getRoomParticipants(roomId)).map(p => p.userId);
  }

  async getRoomState(roomId: string): Promise<any> {
    return await getRoomState(roomId);
  }

  async getAllRooms(): Promise<WatchTogetherRoom[]> {
    const activeRoomIds = await getActiveRooms();
    const rooms: WatchTogetherRoom[] = [];
    
    for (const roomId of activeRoomIds) {
      const room = await getRoom(roomId);
      if (room) {
        rooms.push(room as WatchTogetherRoom);
      }
    }
    
    return rooms;
  }

  async cleanupEmptyRooms(): Promise<number> {
    const activeRoomIds = await getActiveRooms();
    const emptyRooms: string[] = [];
    
    for (const roomId of activeRoomIds) {
      const participants = await getRoomParticipants(roomId);
      
      if (participants.length === 0) {
        emptyRooms.push(roomId);
      }
    }
    
    if (emptyRooms.length > 0) {
      // Use batch cleanup for better performance
      const client = getRedisClient();
      const multi = client.multi();
      
      for (const roomId of emptyRooms) {
        multi.del(`${RedisKeys.rooms}${roomId}`);
        multi.del(`${RedisKeys.roomParticipants}${roomId}`);
        multi.del(`${RedisKeys.roomState}${roomId}`);
        multi.sRem(RedisKeys.activeRooms, roomId);
      }
      
      await multi.exec();
      logger.info(`Batch cleaned up ${emptyRooms.length} empty rooms`);
      return emptyRooms.length;
    }
    
    return 0;
  }

  // Get paginated list of rooms for better performance
  async getRoomsWithPagination(page: number = 1, limit: number = 20): Promise<{
    rooms: WatchTogetherRoom[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const result = await getRoomsWithPagination(page, limit);
    return {
      ...result,
      rooms: result.rooms.map(room => ({ ...room, isPublic: room.isPublic ?? true } as WatchTogetherRoom)),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit)
      }
    };
  }

  // Batch renew TTL for multiple rooms (optimized)
  async batchRenewRoomTTLs(roomIds: string[], ttl: number = 3600): Promise<void> {
    await batchRenewRoomTTLs(roomIds.map(id => ({ id, expiresAt: new Date(Date.now() + ttl * 1000) })), ttl);
  }

  async broadcastToRoom(roomId: string, event: string, data: any): Promise<void> {
    this.io.to(roomId).emit(event, data);
  }

  async getRoomStats(): Promise<any> {
    const rooms = await this.getAllRooms();
    
    return {
      totalRooms: rooms.length,
      totalParticipants: rooms.reduce((sum, room) => sum + room.participants.length, 0),
      roomsWithParticipants: rooms.filter(room => room.participants.length > 0).length,
      averageParticipantsPerRoom: rooms.length > 0 ?
        Math.round((rooms.reduce((sum, room) => sum + room.participants.length, 0) / rooms.length) * 100) / 100 : 0,
      maxParticipantsPerRoom: this.MAX_PARTICIPANTS
    };
  }

  async transferAdmin(roomId: string, currentAdminId: string, newAdminId: string): Promise<boolean> {
    try {
      const room = await getRoom(roomId);
      if (!room || room.adminId !== currentAdminId) {
        return false;
      }

      room.adminId = newAdminId;
      room.updatedAt = new Date();
      
      await setRoom(roomId, room);
      
      this.io.to(roomId).emit('admin_changed', {
        newAdmin: newAdminId,
        oldAdmin: currentAdminId,
        participants: room.participants
      });

      return true;
    } catch (error) {
      logger.error('Error transferring admin:', error);
      return false;
    }
  }

  async kickUser(roomId: string, adminId: string, userIdToKick: string): Promise<boolean> {
    try {
      const room = await getRoom(roomId);
      if (!room || room.adminId !== adminId) {
        return false;
      }

      if (!room.participants.includes(userIdToKick)) {
        return false;
      }

      await removeRoomParticipant(roomId, userIdToKick);
      room.participants = room.participants.filter((id: string) => id !== userIdToKick);
      
      // If kicking the admin, transfer to someone else
      if (room.adminId === userIdToKick && room.participants.length > 0) {
        const newAdmin = room.participants[0];
        (room as any).adminId = newAdmin;
        
        this.io.to(roomId).emit('admin_changed', {
          newAdmin,
          oldAdmin: userIdToKick,
          participants: room.participants
        });
      }

      room.updatedAt = new Date();
      await setRoom(roomId, room);

      this.io.to(roomId).emit('user_kicked', {
        kickedUserId: userIdToKick,
        participants: room.participants
      });

      return true;
    } catch (error) {
      logger.error('Error kicking user:', error);
      return false;
    }
  }
  async createRoom(roomData: {
    name: string;
    adminId: string;
    mediaId: string;
    mediaType: 'movie' | 'tv';
    providerId?: string;
    isPublic?: boolean;
    maxParticipants?: number;
  }): Promise<WatchTogetherRoom> {
    const roomId = uuidv4();
    const isPublic = roomData.isPublic ?? true;
    const maxParticipants = roomData.maxParticipants ?? 10;
    const shareableLink = isPublic ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/watch-together/${roomId}` : undefined;
    
    const room: WatchTogetherRoom = {
      id: roomId,
      name: roomData.name,
      hostId: roomData.adminId,
      adminId: roomData.adminId,
      mediaId: roomData.mediaId,
      mediaType: roomData.mediaType,
      providerId: roomData.providerId || 'vidnest',
      participants: [roomData.adminId],
      currentState: {
        playbackState: {
          isPlaying: false,
          currentTime: 0,
          volume: 1
        },
        timestamp: Date.now()
      },
      isPublic,
      ...(shareableLink && { shareableLink }),
      maxParticipants,
      settings: {
        autoPlay: true,
        allowChat: true,
        maxParticipants: maxParticipants
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Use atomic operations to create room and add to active rooms set
    const client = getRedisClient();
    const multi = client.multi();
    
    // Set room data
    multi.setEx(`${RedisKeys.rooms}${roomId}`, 3600, JSON.stringify(room));
    
    // Add admin as participant
    multi.sAdd(`${RedisKeys.roomParticipants}${roomId}`, roomData.adminId);
    multi.expire(`${RedisKeys.roomParticipants}${roomId}`, 3600);
    
    // Set initial room state
    multi.setEx(`${RedisKeys.roomState}${roomId}`, 3600, JSON.stringify(room.currentState));
    
    // Add room to active rooms set
    multi.sAdd(RedisKeys.activeRooms, roomId);
    multi.expire(RedisKeys.activeRooms, 86400);
    
    await multi.exec();
    
    return room;
  }

  async addUserToRoom(roomId: string, userId: string): Promise<void> {
    await addRoomParticipant(roomId, userId);
  }

  async removeUserFromRoom(roomId: string, userId: string): Promise<void> {
    await removeRoomParticipant(roomId, userId);
  }

  async skipTime(roomId: string, adminId: string, skipType: 'forward' | 'backward', skipAmount: number): Promise<void> {
    const room = await getRoom(roomId);
    if (!room) throw new Error('Room not found');

    if (room.adminId !== adminId) {
      throw new Error('Only admin can skip time');
    }

    const currentState = await getRoomState(roomId);
    let newTime = currentState?.currentTime || 0;
    
    if (skipType === 'forward') {
      newTime += skipAmount;
    } else {
      newTime = Math.max(0, newTime - skipAmount);
    }

    const updatedState = {
      ...currentState,
      playbackState: {
        isPlaying: currentState?.playbackState?.isPlaying ?? false,
        currentTime: newTime,
        volume: currentState?.playbackState?.volume ?? 1
      },
      updatedAt: new Date(),
      timestamp: Date.now()
    };

    await setRoomState({
      roomId,
      currentVideo: {
        id: '',
        title: '',
        provider: '',
        timestamp: Date.now(),
        duration: 0
      },
      playbackState: updatedState,
      lastUpdate: new Date()
    });
    await setRoom(roomId, {
      ...room,
      currentState: updatedState,
      updatedAt: new Date()
    });

    this.io.to(roomId).emit('time_skipped', {
      action: skipType,
      amount: skipAmount,
      newTime,
      adminId,
      timestamp: new Date()
    });
  }

  async pausePlayback(roomId: string, adminId: string): Promise<void> {
    const room = await getRoom(roomId);
    if (!room) throw new Error('Room not found');

    if (room.adminId !== adminId) {
      throw new Error('Only admin can stop playback');
    }

    const currentState = await getRoomState(roomId);
    const updatedState = {
      ...currentState,
      playbackState: {
        isPlaying: false,
        currentTime: currentState?.playbackState?.currentTime ?? 0,
        volume: currentState?.playbackState?.volume ?? 1
      },
      updatedAt: new Date(),
      timestamp: Date.now()
    };

    await setRoomState({
      roomId,
      currentVideo: {
        id: '',
        title: '',
        provider: '',
        timestamp: Date.now(),
        duration: 0
      },
      playbackState: updatedState,
      lastUpdate: new Date()
    });
    await setRoom(roomId, {
      ...room,
      currentState: updatedState,
      updatedAt: new Date()
    });

    this.io.to(roomId).emit('playback_paused', {
      adminId,
      timestamp: new Date(),
      reason: 'admin_stopped_playback'
    });
  }

  async endSession(roomId: string, adminId: string, reason?: string): Promise<void> {
    const room = await getRoom(roomId);
    if (!room) throw new Error('Room not found');

    if (room.adminId !== adminId) {
      throw new Error('Only admin can end session');
    }

    this.io.to(roomId).emit('session_ended', {
      reason: reason || 'admin_ended_session',
      timestamp: new Date(),
      endedBy: adminId
    });

    // Use atomic operations to clean up room
    const client = getRedisClient();
    const multi = client.multi();
    
    multi.del(`${RedisKeys.rooms}${roomId}`);
    multi.del(`${RedisKeys.roomParticipants}${roomId}`);
    multi.del(`${RedisKeys.roomState}${roomId}`);
    multi.sRem(RedisKeys.activeRooms, roomId);
    
    await multi.exec();
  }

  // Additional methods for enhanced admin control
  async setRoom(roomId: string, room: WatchTogetherRoom): Promise<void> {
    await setRoom(roomId, room);
  }

  async setRoomState(roomId: string, state: any): Promise<void> {
    await setRoomState(state);
  }

  async deleteRoom(roomId: string): Promise<void> {
    await deleteRoom(roomId);
  }
}

export const watchTogetherService = (io: Server) => new WatchTogetherService(io);
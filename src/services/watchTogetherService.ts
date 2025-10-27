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
  RedisKeys
} from '../config/redis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

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

      socket.on('create_room', async (data, callback) => {
        try {
          const { name, mediaId, mediaType, adminId, providerId } = data;
          const roomId = uuidv4();
          
          const room: WatchTogetherRoom = {
            id: roomId,
            name,
            adminId,
            mediaId,
            mediaType,
            providerId: providerId || 'vidnest',
            participants: [adminId],
            currentState: {
              isPlaying: false,
              currentTime: 0,
              duration: 0,
              playbackRate: 1,
              currentEpisode: 1,
              providerUrl: this.generateProviderUrl(providerId || 'vidnest', mediaId)
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };

          await setRoom(roomId, room);
          await addRoomParticipant(roomId, adminId);
          
          socket.join(roomId);
          socket.data.roomId = roomId;
          socket.data.userId = adminId;

          this.io.to(roomId).emit('room_created', room);
          callback({ success: true, roomId, room });
        } catch (error) {
          logger.error('Error creating room:', error);
          callback({ success: false, error: 'Failed to create room' });
        }
      });

      socket.on('join_room', async (data, callback) => {
        try {
          const { roomId, userId } = data;
          
          const room = await getRoom(roomId);
          if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
          }

          if (room.participants.includes(userId)) {
            callback({ success: false, error: 'Already in room' });
            return;
          }

          if (room.participants.length >= this.MAX_PARTICIPANTS) {
            callback({ success: false, error: 'Room is full' });
            return;
          }

          await addRoomParticipant(roomId, userId);
          room.participants.push(userId);
          
          socket.join(roomId);
          socket.data.roomId = roomId;
          socket.data.userId = userId;

          // Send current state to new user
          const currentState = await getRoomState(roomId);
          socket.emit('initial_state', {
            currentState: currentState || room.currentState,
            participants: room.participants
          });

          this.io.to(roomId).emit('user_joined', { userId, participants: room.participants });
          callback({ success: true, room });
        } catch (error) {
          logger.error('Error joining room:', error);
          callback({ success: false, error: 'Failed to join room' });
        }
      });

      socket.on('leave_room', async (data, callback) => {
        try {
          const { roomId, userId } = data;
          
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
            room.adminId = newAdmin;
            
            this.io.to(roomId).emit('admin_changed', {
              newAdmin,
              oldAdmin: userId,
              participants: room.participants
            });
          }

          if (room.participants.length === 0) {
            await deleteRoom(roomId);
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
          const { roomId, action, userId } = data;
          
          const room = await getRoom(roomId);
          if (!room) {
            logger.error('Room not found for playback action');
            return;
          }

          // Only admin can perform certain actions
          const adminOnlyActions = ['changeMedia', 'changeProvider', 'changeEpisode'];
          if (adminOnlyActions.includes(action.type) && room.adminId !== userId) {
            socket.emit('error', { message: 'Only admin can perform this action' });
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
              stateUpdate.currentTime = 0; // Reset time for new episode
              broadcastEvent = 'episode_changed';
              break;
            case 'changeProvider':
              stateUpdate.providerUrl = this.generateProviderUrl(action.data.provider, room.mediaId);
              stateUpdate.currentTime = 0;
              broadcastEvent = 'provider_changed';
              break;
            case 'changeMedia':
              stateUpdate.mediaId = action.data.mediaId;
              stateUpdate.currentEpisode = 1;
              stateUpdate.currentTime = 0;
              stateUpdate.providerUrl = this.generateProviderUrl(room.providerId, action.data.mediaId);
              broadcastEvent = 'media_changed';
              break;
          }

          room.currentState = { ...room.currentState, ...stateUpdate };
          room.updatedAt = new Date();

          await setRoom(roomId, room);
          await setRoomState(roomId, room.currentState);

          this.io.to(roomId).emit(broadcastEvent, {
            action,
            state: room.currentState,
            userId,
            timestamp: room.updatedAt
          });
        } catch (error) {
          logger.error('Error handling playback action:', error);
        }
      });

      socket.on('sync_request', async (data) => {
        try {
          const { roomId, userId } = data;
          
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
          const { roomId, userId } = data;
          if (roomId && userId) {
            // Update user activity timestamp
            await addRoomParticipant(roomId, userId);
          }
        } catch (error) {
          logger.error('Error handling heartbeat:', error);
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
              
              // If admin leaves, transfer admin to another participant
              if (room.adminId === userId && room.participants.length > 0) {
                const newAdmin = room.participants[0];
                room.adminId = newAdmin;
                
                this.io.to(roomId).emit('admin_changed', {
                  newAdmin,
                  oldAdmin: userId,
                  participants: room.participants
                });
              }

              if (room.participants.length === 0) {
                await deleteRoom(roomId);
                this.io.to(roomId).emit('room_deleted', { roomId });
              } else {
                this.io.to(roomId).emit('user_left', { userId, participants: room.participants });
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
        await this.cleanupEmptyRooms();
      } catch (error) {
        logger.error('Error during room cleanup:', error);
      }
    }, this.ROOM_CLEANUP_INTERVAL);
  }

  async getRoom(roomId: string): Promise<WatchTogetherRoom | null> {
    return await getRoom(roomId);
  }

  async getRoomParticipants(roomId: string): Promise<string[]> {
    return await getRoomParticipants(roomId);
  }

  async getRoomState(roomId: string): Promise<any> {
    return await getRoomState(roomId);
  }

  async getAllRooms(): Promise<WatchTogetherRoom[]> {
    const client = getRedisClient();
    const keys = await client.keys(`${RedisKeys.rooms}*`);
    
    const rooms: WatchTogetherRoom[] = [];
    for (const key of keys) {
      const data = await client.get(key);
      if (data) {
        rooms.push(JSON.parse(data));
      }
    }
    
    return rooms;
  }

  async cleanupEmptyRooms(): Promise<number> {
    const client = getRedisClient();
    const keys = await client.keys(`${RedisKeys.rooms}*`);
    
    let cleanedCount = 0;
    for (const key of keys) {
      const roomId = key.replace(RedisKeys.rooms, '');
      const participants = await getRoomParticipants(roomId);
      
      if (participants.length === 0) {
        await deleteRoom(roomId);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
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
        room.adminId = newAdmin;
        
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
  }): Promise<WatchTogetherRoom> {
    const roomId = uuidv4();
    
    const room: WatchTogetherRoom = {
      id: roomId,
      name: roomData.name,
      adminId: roomData.adminId,
      mediaId: roomData.mediaId,
      mediaType: roomData.mediaType,
      providerId: roomData.providerId || 'vidnest',
      participants: [roomData.adminId],
      currentState: {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackRate: 1,
        providerUrl: this.generateProviderUrl(roomData.providerId || 'vidnest', roomData.mediaId)
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setRoom(roomId, room);
    await addRoomParticipant(roomId, roomData.adminId);
    
    return room;
  }
}

export const watchTogetherService = (io: Server) => new WatchTogetherService(io);
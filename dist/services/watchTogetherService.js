"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchTogetherService = exports.WatchTogetherService = void 0;
const redis_1 = require("../config/redis");
const uuid_1 = require("uuid");
class WatchTogetherService {
    constructor(io) {
        this.rooms = new Map();
        this.io = io;
        this.setupSocketHandlers();
    }
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.id}`);
            socket.on('create_room', async (data, callback) => {
                try {
                    const { name, mediaId, mediaType, adminId } = data;
                    const roomId = (0, uuid_1.v4)();
                    const room = {
                        id: roomId,
                        name,
                        adminId,
                        mediaId,
                        mediaType,
                        participants: [adminId],
                        currentState: {
                            isPlaying: false,
                            currentTime: 0,
                            duration: 0,
                            playbackRate: 1
                        },
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    await (0, redis_1.setRoom)(roomId, room);
                    await (0, redis_1.addRoomParticipant)(roomId, adminId);
                    socket.join(roomId);
                    socket.data.roomId = roomId;
                    socket.data.userId = adminId;
                    this.io.to(roomId).emit('room_created', room);
                    callback({ success: true, roomId });
                }
                catch (error) {
                    console.error('Error creating room:', error);
                    callback({ success: false, error: 'Failed to create room' });
                }
            });
            socket.on('join_room', async (data, callback) => {
                try {
                    const { roomId, userId } = data;
                    const room = await (0, redis_1.getRoom)(roomId);
                    if (!room) {
                        callback({ success: false, error: 'Room not found' });
                        return;
                    }
                    if (room.participants.includes(userId)) {
                        callback({ success: false, error: 'Already in room' });
                        return;
                    }
                    await (0, redis_1.addRoomParticipant)(roomId, userId);
                    room.participants.push(userId);
                    socket.join(roomId);
                    socket.data.roomId = roomId;
                    socket.data.userId = userId;
                    this.io.to(roomId).emit('user_joined', { userId, participants: room.participants });
                    callback({ success: true, room });
                }
                catch (error) {
                    console.error('Error joining room:', error);
                    callback({ success: false, error: 'Failed to join room' });
                }
            });
            socket.on('leave_room', async (data, callback) => {
                try {
                    const { roomId, userId } = data;
                    const room = await (0, redis_1.getRoom)(roomId);
                    if (!room) {
                        callback({ success: false, error: 'Room not found' });
                        return;
                    }
                    await (0, redis_1.removeRoomParticipant)(roomId, userId);
                    room.participants = room.participants.filter((id) => id !== userId);
                    socket.leave(roomId);
                    delete socket.data.roomId;
                    delete socket.data.userId;
                    if (room.participants.length === 0) {
                        await (0, redis_1.deleteRoom)(roomId);
                        this.io.to(roomId).emit('room_deleted', { roomId });
                    }
                    else {
                        this.io.to(roomId).emit('user_left', { userId, participants: room.participants });
                    }
                    callback({ success: true });
                }
                catch (error) {
                    console.error('Error leaving room:', error);
                    callback({ success: false, error: 'Failed to leave room' });
                }
            });
            socket.on('playback_action', async (data) => {
                try {
                    const { roomId, action, userId } = data;
                    const room = await (0, redis_1.getRoom)(roomId);
                    if (!room) {
                        console.error('Room not found for playback action');
                        return;
                    }
                    if (room.adminId !== userId) {
                        console.error('Non-admin user attempted playback action');
                        return;
                    }
                    let stateUpdate = {};
                    switch (action.type) {
                        case 'play':
                            stateUpdate.isPlaying = true;
                            break;
                        case 'pause':
                            stateUpdate.isPlaying = false;
                            break;
                        case 'seek':
                            stateUpdate.currentTime = action.data.currentTime;
                            break;
                        case 'setPlaybackRate':
                            stateUpdate.playbackRate = action.data.rate;
                            break;
                        case 'updateTime':
                            stateUpdate.currentTime = action.data.currentTime;
                            break;
                    }
                    room.currentState = { ...room.currentState, ...stateUpdate };
                    room.updatedAt = new Date();
                    await (0, redis_1.setRoom)(roomId, room);
                    await (0, redis_1.setRoomState)(roomId, room.currentState);
                    this.io.to(roomId).emit('playback_updated', {
                        action,
                        state: room.currentState,
                        timestamp: room.updatedAt
                    });
                }
                catch (error) {
                    console.error('Error handling playback action:', error);
                }
            });
            socket.on('sync_request', async (data) => {
                try {
                    const { roomId, userId } = data;
                    const room = await (0, redis_1.getRoom)(roomId);
                    if (!room) {
                        console.error('Room not found for sync request');
                        return;
                    }
                    const currentState = await (0, redis_1.getRoomState)(roomId);
                    socket.emit('sync_response', {
                        currentState: currentState || room.currentState,
                        timestamp: room.updatedAt
                    });
                }
                catch (error) {
                    console.error('Error handling sync request:', error);
                }
            });
            socket.on('disconnect', async () => {
                try {
                    if (socket.data.roomId && socket.data.userId) {
                        const { roomId, userId } = socket.data;
                        const room = await (0, redis_1.getRoom)(roomId);
                        if (room) {
                            await (0, redis_1.removeRoomParticipant)(roomId, userId);
                            room.participants = room.participants.filter((id) => id !== userId);
                            if (room.participants.length === 0) {
                                await (0, redis_1.deleteRoom)(roomId);
                                this.io.to(roomId).emit('room_deleted', { roomId });
                            }
                            else {
                                this.io.to(roomId).emit('user_left', { userId, participants: room.participants });
                            }
                        }
                    }
                }
                catch (error) {
                    console.error('Error handling disconnect:', error);
                }
            });
        });
    }
    async getRoom(roomId) {
        return await (0, redis_1.getRoom)(roomId);
    }
    async getRoomParticipants(roomId) {
        return await (0, redis_1.getRoomParticipants)(roomId);
    }
    async getRoomState(roomId) {
        return await (0, redis_1.getRoomState)(roomId);
    }
    async getAllRooms() {
        const client = (0, redis_1.getRedisClient)();
        const keys = await client.keys(`${redis_1.RedisKeys.rooms}*`);
        const rooms = [];
        for (const key of keys) {
            const data = await client.get(key);
            if (data) {
                rooms.push(JSON.parse(data));
            }
        }
        return rooms;
    }
    async cleanupEmptyRooms() {
        const client = (0, redis_1.getRedisClient)();
        const keys = await client.keys(`${redis_1.RedisKeys.rooms}*`);
        let cleanedCount = 0;
        for (const key of keys) {
            const roomId = key.replace(redis_1.RedisKeys.rooms, '');
            const participants = await (0, redis_1.getRoomParticipants)(roomId);
            if (participants.length === 0) {
                await (0, redis_1.deleteRoom)(roomId);
                cleanedCount++;
            }
        }
        return cleanedCount;
    }
    async broadcastToRoom(roomId, event, data) {
        this.io.to(roomId).emit(event, data);
    }
    async getRoomStats() {
        const rooms = await this.getAllRooms();
        return {
            totalRooms: rooms.length,
            totalParticipants: rooms.reduce((sum, room) => sum + room.participants.length, 0),
            roomsWithParticipants: rooms.filter(room => room.participants.length > 0).length,
            averageParticipantsPerRoom: rooms.length > 0 ?
                Math.round((rooms.reduce((sum, room) => sum + room.participants.length, 0) / rooms.length) * 100) / 100 : 0
        };
    }
}
exports.WatchTogetherService = WatchTogetherService;
const watchTogetherService = (io) => new WatchTogetherService(io);
exports.watchTogetherService = watchTogetherService;
//# sourceMappingURL=watchTogetherService.js.map
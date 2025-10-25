"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const watchTogetherService_1 = require("../services/watchTogetherService");
const sanitizer_1 = require("../utils/sanitizer");
const errorHandler_1 = require("../utils/errorHandler");
const watchTogetherRoutes = async (fastify) => {
    const io = fastify.io;
    const wtService = (0, watchTogetherService_1.watchTogetherService)(io);
    fastify.post('/rooms', {
        schema: {
            body: {
                type: 'object',
                required: ['name', 'mediaId', 'mediaType', 'adminId'],
                properties: {
                    name: { type: 'string', maxLength: 100 },
                    mediaId: { type: 'string', maxLength: 20 },
                    mediaType: { type: 'string', enum: ['movie', 'tv'] },
                    adminId: { type: 'string', maxLength: 50 }
                }
            },
            response: {
                201: {
                    type: 'object',
                    required: ['success', 'data'],
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            required: ['id', 'name', 'adminId', 'mediaId', 'mediaType', 'participants', 'currentState'],
                            properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                adminId: { type: 'string' },
                                mediaId: { type: 'string' },
                                mediaType: { type: 'string', enum: ['movie', 'tv'] },
                                participants: { type: 'array', items: { type: 'string' } },
                                currentState: {
                                    type: 'object',
                                    properties: {
                                        isPlaying: { type: 'boolean' },
                                        currentTime: { type: 'number' },
                                        duration: { type: 'number' },
                                        playbackRate: { type: 'number' }
                                    }
                                },
                                createdAt: { type: 'string', format: 'date-time' },
                                updatedAt: { type: 'string', format: 'date-time' }
                            }
                        }
                    }
                },
                400: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                },
                500: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const roomData = (0, sanitizer_1.sanitizeRoomData)(request.body);
            if (!roomData) {
                return reply.code(400).send({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'Invalid room data'
                });
            }
            const room = await wtService.getRoom(roomData.name);
            if (room) {
                return reply.code(409).send({
                    statusCode: 409,
                    error: 'Conflict',
                    message: 'Room with this name already exists'
                });
            }
            const newRoom = {
                id: Math.random().toString(36).substr(2, 9),
                name: roomData.name,
                adminId: roomData.adminId,
                mediaId: roomData.mediaId,
                mediaType: roomData.mediaType,
                participants: [roomData.adminId],
                currentState: {
                    isPlaying: false,
                    currentTime: 0,
                    duration: 0,
                    playbackRate: 1
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            return { success: true, data: newRoom };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, { context: 'Create watch-together room' });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
    fastify.post('/rooms/:roomId/join', {
        schema: {
            params: {
                type: 'object',
                required: ['roomId'],
                properties: {
                    roomId: { type: 'string', maxLength: 50 }
                }
            },
            body: {
                type: 'object',
                required: ['userId'],
                properties: {
                    userId: { type: 'string', maxLength: 50 }
                }
            },
            response: {
                200: {
                    type: 'object',
                    required: ['success', 'data'],
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            required: ['id', 'name', 'adminId', 'mediaId', 'mediaType', 'participants', 'currentState'],
                            properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                adminId: { type: 'string' },
                                mediaId: { type: 'string' },
                                mediaType: { type: 'string', enum: ['movie', 'tv'] },
                                participants: { type: 'array', items: { type: 'string' } },
                                currentState: {
                                    type: 'object',
                                    properties: {
                                        isPlaying: { type: 'boolean' },
                                        currentTime: { type: 'number' },
                                        duration: { type: 'number' },
                                        playbackRate: { type: 'number' }
                                    }
                                },
                                createdAt: { type: 'string', format: 'date-time' },
                                updatedAt: { type: 'string', format: 'date-time' }
                            }
                        }
                    }
                },
                400: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                },
                404: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                },
                500: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { roomId } = request.params;
            const { userId } = request.body;
            const sanitizedUserId = (0, sanitizer_1.sanitizeUserId)(userId);
            if (!sanitizedUserId) {
                return reply.code(400).send({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'Invalid user ID'
                });
            }
            const room = await wtService.getRoom(roomId);
            if (!room) {
                return reply.code(404).send({
                    statusCode: 404,
                    error: 'Not Found',
                    message: 'Room not found'
                });
            }
            if (room.participants.includes(sanitizedUserId)) {
                return reply.code(409).send({
                    statusCode: 409,
                    error: 'Conflict',
                    message: 'User already in room'
                });
            }
            const updatedRoom = {
                ...room,
                participants: [...room.participants, sanitizedUserId],
                updatedAt: new Date()
            };
            return { success: true, data: updatedRoom };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, {
                context: 'Join watch-together room',
                roomId: request.params.roomId,
                userId: request.body.userId
            });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
    fastify.post('/rooms/:roomId/leave', {
        schema: {
            params: {
                type: 'object',
                required: ['roomId'],
                properties: {
                    roomId: { type: 'string', maxLength: 50 }
                }
            },
            body: {
                type: 'object',
                required: ['userId'],
                properties: {
                    userId: { type: 'string', maxLength: 50 }
                }
            },
            response: {
                200: {
                    type: 'object',
                    required: ['success'],
                    properties: {
                        success: { type: 'boolean' }
                    }
                },
                400: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                },
                404: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                },
                500: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { roomId } = request.params;
            const { userId } = request.body;
            const sanitizedUserId = (0, sanitizer_1.sanitizeUserId)(userId);
            if (!sanitizedUserId) {
                return reply.code(400).send({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'Invalid user ID'
                });
            }
            const room = await wtService.getRoom(roomId);
            if (!room) {
                return reply.code(404).send({
                    statusCode: 404,
                    error: 'Not Found',
                    message: 'Room not found'
                });
            }
            if (!room.participants.includes(sanitizedUserId)) {
                return reply.code(404).send({
                    statusCode: 404,
                    error: 'Not Found',
                    message: 'User not in room'
                });
            }
            return { success: true };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, {
                context: 'Leave watch-together room',
                roomId: request.params.roomId,
                userId: request.body.userId
            });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
    fastify.get('/rooms/:roomId', {
        schema: {
            params: {
                type: 'object',
                required: ['roomId'],
                properties: {
                    roomId: { type: 'string', maxLength: 50 }
                }
            },
            response: {
                200: {
                    type: 'object',
                    required: ['success', 'data'],
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            required: ['id', 'name', 'adminId', 'mediaId', 'mediaType', 'participants', 'currentState'],
                            properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                adminId: { type: 'string' },
                                mediaId: { type: 'string' },
                                mediaType: { type: 'string', enum: ['movie', 'tv'] },
                                participants: { type: 'array', items: { type: 'string' } },
                                currentState: {
                                    type: 'object',
                                    properties: {
                                        isPlaying: { type: 'boolean' },
                                        currentTime: { type: 'number' },
                                        duration: { type: 'number' },
                                        playbackRate: { type: 'number' }
                                    }
                                },
                                createdAt: { type: 'string', format: 'date-time' },
                                updatedAt: { type: 'string', format: 'date-time' }
                            }
                        }
                    }
                },
                404: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                },
                500: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { roomId } = request.params;
            const room = await wtService.getRoom(roomId);
            if (!room) {
                return reply.code(404).send({
                    statusCode: 404,
                    error: 'Not Found',
                    message: 'Room not found'
                });
            }
            return { success: true, data: room };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, {
                context: 'Get watch-together room',
                roomId: request.params.roomId
            });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
    fastify.get('/rooms', {
        schema: {
            response: {
                200: {
                    type: 'object',
                    required: ['success', 'data'],
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['id', 'name', 'adminId', 'mediaId', 'mediaType', 'participants', 'currentState'],
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string' },
                                    adminId: { type: 'string' },
                                    mediaId: { type: 'string' },
                                    mediaType: { type: 'string', enum: ['movie', 'tv'] },
                                    participants: { type: 'array', items: { type: 'string' } },
                                    currentState: {
                                        type: 'object',
                                        properties: {
                                            isPlaying: { type: 'boolean' },
                                            currentTime: { type: 'number' },
                                            duration: { type: 'number' },
                                            playbackRate: { type: 'number' }
                                        }
                                    },
                                    createdAt: { type: 'string', format: 'date-time' },
                                    updatedAt: { type: 'string', format: 'date-time' }
                                }
                            }
                        }
                    }
                },
                500: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const rooms = await wtService.getAllRooms();
            return { success: true, data: rooms };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, { context: 'Get all watch-together rooms' });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
    fastify.get('/stats', {
        schema: {
            response: {
                200: {
                    type: 'object',
                    required: ['success', 'data'],
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                totalRooms: { type: 'number' },
                                totalParticipants: { type: 'number' },
                                roomsWithParticipants: { type: 'number' },
                                averageParticipantsPerRoom: { type: 'number' }
                            }
                        }
                    }
                },
                500: {
                    type: 'object',
                    required: ['statusCode', 'error', 'message'],
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const stats = await wtService.getRoomStats();
            return { success: true, data: stats };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, { context: 'Get watch-together statistics' });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
};
exports.default = watchTogetherRoutes;
//# sourceMappingURL=watchTogether.js.map
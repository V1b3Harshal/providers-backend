import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { watchTogetherService } from '../services/watchTogetherService';
import { sanitizeRoomData, sanitizePlaybackAction, sanitizeUserId } from '../utils/sanitizer';
import { createSafeErrorResponse, logErrorWithDetails } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { supabaseAuth } from '../middleware/supabaseAuth';

const watchTogetherRoutes: FastifyPluginAsync = async (fastify) => {
  const io = (fastify as any).io;
  const wtService = watchTogetherService(io);
  // Apply Supabase authentication to all watch together routes
  fastify.addHook('onRequest', supabaseAuth);

  // Create a new watch-together room
  fastify.post('/rooms', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'mediaId', 'mediaType'],
        properties: {
          name: { type: 'string', maxLength: 100 },
          mediaId: { type: 'string', maxLength: 20 },
          mediaType: { type: 'string', enum: ['movie', 'tv'] },
          providerId: { type: 'string', maxLength: 50 }
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
      const user = (request as any).user;
      const roomData = sanitizeRoomData(request.body);
      if (!roomData) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid room data'
        });
      }

      // Use authenticated user as admin instead of provided adminId
      const adminId = user.userId;
      
      const existingRoom = await wtService.getAllRooms();
      if (existingRoom.some(r => r.name === roomData.name)) {
        return reply.code(409 as any).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'Room with this name already exists'
        });
      }

      const newRoom = await wtService.createRoom({
        name: roomData.name,
        adminId: adminId,
        mediaId: roomData.mediaId,
        mediaType: roomData.mediaType,
        providerId: roomData.providerId
      });

      return { success: true, data: newRoom };
    } catch (error) {
      logErrorWithDetails(error, { context: 'Create watch-together room' });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Join a watch-together room
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
        properties: {
          shareableLink: { type: 'string', maxLength: 255 }
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
      const { roomId } = request.params as { roomId: string };
      const user = (request as any).user;
      
      const sanitizedUserId = sanitizeUserId(user.userId);
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
        return reply.code(409 as any).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'User already in room'
        });
      }

      await wtService.addUserToRoom(roomId, sanitizedUserId);
      
      const updatedRoom = await wtService.getRoom(roomId);
      return { success: true, data: updatedRoom };
    } catch (error) {
      logErrorWithDetails(error, { 
        context: 'Join watch-together room',
        roomId: (request.params as any).roomId,
        userId: (request.body as any).userId
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Leave a watch-together room
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
        type: 'object'
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
      const { roomId } = request.params as { roomId: string };
      const user = (request as any).user;
      
      const sanitizedUserId = sanitizeUserId(user.userId);
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

      await wtService.removeUserFromRoom(roomId, sanitizedUserId);
      return { success: true };
    } catch (error) {
      logErrorWithDetails(error, { 
        context: 'Leave watch-together room',
        roomId: (request.params as any).roomId,
        userId: (request.body as any).userId
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Get room information
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
      const { roomId } = request.params as { roomId: string };
      
      const room = await wtService.getRoom(roomId);
      if (!room) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Room not found'
        });
      }

      return { success: true, data: room };
    } catch (error) {
      logErrorWithDetails(error, { 
        context: 'Get watch-together room',
        roomId: (request.params as any).roomId
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Get all rooms
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
    } catch (error) {
      logErrorWithDetails(error, { context: 'Get all watch-together rooms' });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Get room statistics
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
    } catch (error) {
      logErrorWithDetails(error, { context: 'Get watch-together statistics' });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Transfer admin ownership
  fastify.post('/rooms/:roomId/transfer-admin', {
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
        required: ['currentAdminId', 'newAdminId'],
        properties: {
          currentAdminId: { type: 'string', maxLength: 50 },
          newAdminId: { type: 'string', maxLength: 50 }
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
        403: {
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
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const user = (request as any).user;
      
      const sanitizedCurrentAdmin = sanitizeUserId(user.userId);
      const { newAdminId } = request.body as { newAdminId: string };
      const sanitizedNewAdmin = sanitizeUserId(newAdminId);
      
      if (!sanitizedCurrentAdmin || !sanitizedNewAdmin) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid user IDs'
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

      if (room.adminId !== sanitizedCurrentAdmin) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only current admin can transfer ownership'
        });
      }

      if (!room.participants.includes(sanitizedNewAdmin)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'New admin must be a room participant'
        });
      }

      const success = await wtService.transferAdmin(roomId, sanitizedCurrentAdmin, sanitizedNewAdmin);
      
      if (!success) {
        return reply.code(500 as any).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to transfer admin'
        });
      }
      
      return { success: true };
    } catch (error) {
      logErrorWithDetails(error, {
        context: 'Transfer admin',
        roomId: (request.params as any).roomId
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Kick user from room
  fastify.post('/rooms/:roomId/kick-user', {
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
        required: ['adminId', 'userIdToKick'],
        properties: {
          adminId: { type: 'string', maxLength: 50 },
          userIdToKick: { type: 'string', maxLength: 50 }
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
        403: {
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
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const user = (request as any).user;
      const { userIdToKick } = request.body as { userIdToKick: string };
      
      const sanitizedAdmin = sanitizeUserId(user.userId);
      const sanitizedUserToKick = sanitizeUserId(userIdToKick);
      
      if (!sanitizedAdmin || !sanitizedUserToKick) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid user IDs'
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

      if (room.adminId !== sanitizedAdmin) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only admin can kick users'
        });
      }

      if (!room.participants.includes(sanitizedUserToKick)) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not in room'
        });
      }

      if (sanitizedUserToKick === sanitizedAdmin) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Admin cannot kick themselves'
        });
      }

      const success = await wtService.kickUser(roomId, sanitizedAdmin, sanitizedUserToKick);
      
      if (!success) {
        return reply.code(500 as any).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to kick user'
        });
      }
      
      return { success: true };
    } catch (error) {
      logErrorWithDetails(error, {
        context: 'Kick user',
        roomId: (request.params as any).roomId
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });


  // Admin ends watch together session
  fastify.post('/rooms/:roomId/end-session', {
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
        required: ['adminId'],
        properties: {
          adminId: { type: 'string', maxLength: 50 },
          reason: { type: 'string', maxLength: 100 }
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
        403: {
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
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const user = (request as any).user;
      const { reason } = request.body as { reason?: string };
      
      const sanitizedAdmin = sanitizeUserId(user.userId);
      if (!sanitizedAdmin) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid admin ID'
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

      if (room.adminId !== sanitizedAdmin) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only admin can end session'
        });
      }

      await wtService.endSession(roomId, user.userId, reason);
      return { success: true };
    } catch (error) {
      logErrorWithDetails(error, {
        context: 'End watch together session',
        roomId: (request.params as any).roomId
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Admin skips forward/backward in playback
  fastify.post('/rooms/:roomId/skip-time', {
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
        required: ['adminId', 'skipType', 'skipAmount'],
        properties: {
          adminId: { type: 'string', maxLength: 50 },
          skipType: { type: 'string', enum: ['forward', 'backward'] },
          skipAmount: { type: 'number', minimum: 1 }
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
        403: {
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
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const user = (request as any).user;
      const { skipType, skipAmount } = request.body as { skipType: 'forward' | 'backward'; skipAmount: number };
      
      const sanitizedAdmin = sanitizeUserId(user.userId);
      if (!sanitizedAdmin) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid admin ID'
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

      if (room.adminId !== sanitizedAdmin) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only admin can skip time'
        });
      }

      await wtService.skipTime(roomId, user.userId, skipType, skipAmount);
      return { success: true };
    } catch (error) {
      logErrorWithDetails(error, {
        context: 'Skip time in playback',
        roomId: (request.params as any).roomId
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Admin stops playback for everyone
  fastify.post('/rooms/:roomId/admin-stop-playback', {
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
        required: ['adminId'],
        properties: {
          adminId: { type: 'string', maxLength: 50 }
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
        403: {
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
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const user = (request as any).user;
      
      const sanitizedAdmin = sanitizeUserId(user.userId);
      if (!sanitizedAdmin) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid admin ID'
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

      if (room.adminId !== sanitizedAdmin) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only admin can stop playback'
        });
      }

      await wtService.pausePlayback(roomId, user.userId);
      return { success: true };
    } catch (error) {
      logErrorWithDetails(error, {
        context: 'Admin stop playback',
        roomId: (request.params as any).roomId
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Get room shareable link
  fastify.get('/rooms/:roomId/share-link', {
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
              properties: {
                shareableLink: { type: ['string', 'null'] },
                isPublic: { type: 'boolean' }
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
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      
      const room = await wtService.getRoom(roomId);
      if (!room) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Room not found'
        });
      }

      return {
        success: true,
        data: {
          shareableLink: room.shareableLink,
          isPublic: room.isPublic
        }
      };
    } catch (error) {
      logErrorWithDetails(error, {
        context: 'Get shareable link',
        roomId: (request.params as any).roomId
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Update room settings (admin only)
  fastify.put('/rooms/:roomId/settings', {
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
        properties: {
          isPublic: { type: 'boolean' },
          maxParticipants: { type: 'number', minimum: 2, maximum: 50 }
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
              properties: {
                isPublic: { type: 'boolean' },
                maxParticipants: { type: 'number' },
                shareableLink: { type: ['string', 'null'] }
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
        403: {
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
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { roomId } = request.params as { roomId: string };
      const user = (request as any).user;
      const { isPublic, maxParticipants } = request.body as {
        isPublic?: boolean;
        maxParticipants?: number
      };
      
      const sanitizedAdmin = sanitizeUserId(user.userId);
      if (!sanitizedAdmin) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid admin ID'
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

      if (room.adminId !== sanitizedAdmin) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only admin can update room settings'
        });
      }

      // Update room settings
      if (isPublic !== undefined) {
        room.isPublic = isPublic;
        room.shareableLink = isPublic ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/watch-together/${roomId}` : '';
      }
      
      if (maxParticipants !== undefined) {
        room.maxParticipants = maxParticipants;
      }

      room.updatedAt = new Date();
      await wtService.setRoom(roomId, room);

      return {
        success: true,
        data: {
          isPublic: room.isPublic,
          maxParticipants: room.maxParticipants,
          shareableLink: room.shareableLink
        }
      };
    } catch (error) {
      logErrorWithDetails(error, {
        context: 'Update room settings',
        roomId: (request.params as any).roomId
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });
};



export default watchTogetherRoutes;
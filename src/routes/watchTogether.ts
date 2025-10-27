import { FastifyPluginAsync } from 'fastify';
import { watchTogetherService } from '../services/watchTogetherService';
import { sanitizeRoomData, sanitizePlaybackAction, sanitizeUserId } from '../utils/sanitizer';
import { createSafeErrorResponse, logErrorWithDetails } from '../utils/errorHandler';
import { logger } from '../utils/logger';

const watchTogetherRoutes: FastifyPluginAsync = async (fastify) => {
  // Create a WebSocket server instance
  const io = (fastify as any).io;
  const wtService = watchTogetherService(io);
  // Create a new watch-together room
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
      const roomData = sanitizeRoomData(request.body);
      if (!roomData) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid room data'
        });
      }

      const room = await wtService.getRoom(roomData.name);
      if (room) {
        return reply.code(409 as any).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'Room with this name already exists'
        });
      }

      const newRoom = await wtService.createRoom({
        name: roomData.name,
        adminId: roomData.adminId,
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
      const { roomId } = request.params as { roomId: string };
      const { userId } = request.body as { userId: string };
      
      const sanitizedUserId = sanitizeUserId(userId);
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

      // In a real implementation, you would add the user to the room here
      // For now, we'll return the updated room
      const updatedRoom = {
        ...room,
        participants: [...room.participants, sanitizedUserId],
        updatedAt: new Date()
      };

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
      const { roomId } = request.params as { roomId: string };
      const { userId } = request.body as { userId: string };
      
      const sanitizedUserId = sanitizeUserId(userId);
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

      // In a real implementation, you would remove the user from the room here
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
      const { currentAdminId, newAdminId } = request.body as { currentAdminId: string; newAdminId: string };
      
      const sanitizedCurrentAdmin = sanitizeUserId(currentAdminId);
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
      
      if (success) {
        return { success: true };
      } else {
        return reply.code(500 as any).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to transfer admin'
        });
      }
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
      const { adminId, userIdToKick } = request.body as { adminId: string; userIdToKick: string };
      
      const sanitizedAdmin = sanitizeUserId(adminId);
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
      
      if (success) {
        return { success: true };
      } else {
        return reply.code(500 as any).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to kick user'
        });
      }
    } catch (error) {
      logErrorWithDetails(error, {
        context: 'Kick user',
        roomId: (request.params as any).roomId
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Get available providers
  fastify.get('/providers', {
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
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  baseUrl: { type: 'string' },
                  enabled: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const providers = [
        { id: 'vidnest', name: 'VidNest', baseUrl: 'https://vidnest.fun', enabled: true },
        { id: 'vidsrc', name: 'VidSrc', baseUrl: 'https://vidsrc.to', enabled: true },
        { id: 'embed', name: 'EmbedStream', baseUrl: 'https://embed.stream', enabled: true }
      ];
      
      return { success: true, data: providers };
    } catch (error) {
      logErrorWithDetails(error, { context: 'Get providers' });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });
};

export default watchTogetherRoutes;
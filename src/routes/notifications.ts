import { FastifyPluginAsync } from 'fastify';
import { oneSignalService } from '../config/onesignal';
import { createSafeErrorResponse, logErrorWithDetails } from '../utils/errorHandler';

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  // Register user device for push notifications
  fastify.post('/register-device', {
    schema: {
      body: {
        type: 'object',
        required: ['playerId', 'userId'],
        properties: {
          playerId: { type: 'string', maxLength: 100 },
          userId: { type: 'string', maxLength: 100 },
          deviceType: { type: 'string', enum: ['ios', 'android', 'web'] },
          language: { type: 'string', maxLength: 10 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { playerId, userId, deviceType, language } = request.body as any;

      // In a real implementation, you'd store this mapping in your database
      // For now, we'll just track it in analytics
      console.log('Device registered', {
        playerId,
        userId,
        deviceType: deviceType || 'web',
        language: language || 'en',
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Device registered successfully',
        playerId,
        userId
      };
    } catch (error) {
      logErrorWithDetails(error, { context: 'Register device' });
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode).send(safeError);
    }
  });

  // Send test notification to user
  fastify.post('/test/:userId', {
    schema: {
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', maxLength: 100 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { userId } = request.params as any;

      const result = await oneSignalService.sendNotificationToUsers([userId], {
        headings: { en: 'Test Notification' },
        contents: { en: 'This is a test notification from your providers backend!' },
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      });

      if (result.success) {
        console.log('Test notification sent', {
          userId,
          notificationId: result.id,
          timestamp: new Date().toISOString()
        });

        return {
          success: true,
          message: 'Test notification sent successfully',
          notificationId: result.id
        };
      } else {
        return reply.code(500).send({
          success: false,
          error: result.error || 'Failed to send notification'
        });
      }
    } catch (error) {
      logErrorWithDetails(error, { context: 'Send test notification' });
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode).send(safeError);
    }
  });

  // Send watch-together notification
  fastify.post('/watch-together', {
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'roomId', 'type'],
        properties: {
          userId: { type: 'string', maxLength: 100 },
          roomId: { type: 'string', maxLength: 50 },
          type: { type: 'string', enum: ['join', 'leave', 'invite', 'admin_action'] },
          message: { type: 'string', maxLength: 200 },
          title: { type: 'string', maxLength: 100 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { userId, roomId, type, message, title } = request.body as any;

      const notificationTitle = title || getNotificationTitle(type);
      const notificationMessage = message || getNotificationMessage(type, roomId);

      const result = await oneSignalService.sendNotificationToUsers([userId], {
        headings: { en: notificationTitle },
        contents: { en: notificationMessage },
        data: {
          type: 'watch_together',
          roomId,
          notificationType: type,
          timestamp: new Date().toISOString()
        }
      });

      if (result.success) {
        console.log('Watch-together notification sent', {
          userId,
          roomId,
          type,
          notificationId: result.id,
          timestamp: new Date().toISOString()
        });

        return {
          success: true,
          message: 'Watch-together notification sent successfully',
          notificationId: result.id
        };
      } else {
        return reply.code(500).send({
          success: false,
          error: result.error || 'Failed to send notification'
        });
      }
    } catch (error) {
      logErrorWithDetails(error, { context: 'Send watch-together notification' });
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode).send(safeError);
    }
  });

  // Get notification statistics
  fastify.get('/stats', async (_request, reply) => {
    try {
      const stats = oneSignalService.getStatus();

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logErrorWithDetails(error, { context: 'Get notification stats' });
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode).send(safeError);
    }
  });
};

// Helper functions for notification content
function getNotificationTitle(type: string): string {
  switch (type) {
    case 'join': return 'User Joined Room';
    case 'leave': return 'User Left Room';
    case 'invite': return 'Watch Party Invitation';
    case 'admin_action': return 'Room Update';
    default: return 'Watch Together Notification';
  }
}

function getNotificationMessage(type: string, roomId: string): string {
  switch (type) {
    case 'join': return `A user joined watch-together room ${roomId}`;
    case 'leave': return `A user left watch-together room ${roomId}`;
    case 'invite': return `You're invited to join watch-together room ${roomId}`;
    case 'admin_action': return `Room ${roomId} has been updated`;
    default: return `Watch-together notification for room ${roomId}`;
  }
}

export default notificationsRoutes;
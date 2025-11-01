import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';

export const userAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const token = request.headers.authorization?.split(' ')[1];
    
    if (!token) {
      logger.warn('Missing authorization token', {
        url: request.url,
        method: request.method,
        ip: request.ip
      });
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing authorization token'
      });
    }
    
    try {
      const decoded = verifyToken(request.server, token);
      
      // Validate token payload fields
      if (!decoded.userId || !decoded.email) {
        logger.warn('Invalid token payload', {
          url: request.url,
          method: request.method,
          ip: request.ip
        });
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid token payload'
        });
      }
      
      // Add user info to request for use in route handlers
      (request as any).user = decoded;
      logger.debug('User authenticated successfully', {
        userId: decoded.userId,
        email: decoded.email,
        url: request.url
      });
      
    } catch (error) {
      logger.warn('Invalid token', {
        url: request.url,
        method: request.method,
        ip: request.ip,
        error: error instanceof Error ? error.message : String(error)
      });
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    logger.error('Authentication middleware error', {
      url: request.url,
      method: request.method,
      ip: request.ip,
      error: error instanceof Error ? error.message : String(error)
    });
    return reply.code(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};
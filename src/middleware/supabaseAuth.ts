import { FastifyRequest, FastifyReply } from 'fastify';
import { validateSupabaseToken } from '../config/supabase';
import { logger } from '../utils/logger';

export const supabaseAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header', {
        url: request.url,
        method: request.method,
        ip: request.ip,
        hasAuthHeader: !!authHeader
      });
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      // Validate token with Supabase
      const user = await validateSupabaseToken(token);

      // Validate user payload
      if (!user.id || !user.email) {
        logger.warn('Invalid user payload from Supabase', {
          url: request.url,
          method: request.method,
          ip: request.ip,
          userId: user.id,
          hasEmail: !!user.email
        });
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid user data'
        });
      }

      // Add user info to request for use in route handlers
      (request as any).user = {
        id: user.id,
        email: user.email,
        userId: user.id, // For compatibility with existing code
        // Add other user fields as needed
        ...user
      };

      logger.debug('User authenticated successfully via Supabase', {
        userId: user.id,
        email: user.email,
        url: request.url
      });

    } catch (tokenError) {
      logger.warn('Invalid Supabase token', {
        url: request.url,
        method: request.method,
        ip: request.ip,
        error: tokenError instanceof Error ? tokenError.message : String(tokenError)
      });
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    logger.error('Supabase authentication middleware error', {
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
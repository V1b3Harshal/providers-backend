import { FastifyJWT } from '@fastify/jwt';
import { JWTPayload } from '../types/jwt';

export const verifyToken = (fastify: any, token: string): any => {
  try {
    return fastify.jwt.verify(token);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const generateToken = (fastify: any, payload: JWTPayload): string => {
  return fastify.jwt.sign(
    { userId: payload.userId, email: payload.email },
    { expiresIn: '15m' }
  );
};
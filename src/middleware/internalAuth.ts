import { FastifyRequest, FastifyReply } from 'fastify';
import { INTERNAL_API_KEY } from '../config/environment';

export const internalAuth = (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
  const apiKey = request.headers['x-internal-key'];

  if (!apiKey) {
    reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Missing x-internal-key header'
    });
    return;
  }

  if (apiKey !== INTERNAL_API_KEY) {
    reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid x-internal-key'
    });
    return;
  }

  done();
};
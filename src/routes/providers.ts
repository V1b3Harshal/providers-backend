import { FastifyPluginAsync } from 'fastify';
import { providerService } from '../services/providerService';
import { internalAuth } from '../middleware/internalAuth';
import { sanitizeId, sanitizeString } from '../utils/sanitizer';
import { createSafeErrorResponse, logErrorWithDetails, ValidationError, NotFoundError, RateLimitError } from '../utils/errorHandler';

const providersRoutes: FastifyPluginAsync = async (fastify) => {
  // Get provider embed URL - requires internal authentication
  fastify.get('/:provider/:id', { 
    preHandler: [internalAuth],
    schema: {
      params: {
        type: 'object',
        required: ['provider', 'id'],
        properties: {
          provider: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
          id: { type: 'string', pattern: '^[a-zA-Z0-9]+$' }
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
              required: ['provider', 'embedUrl', 'iframeCode'],
              properties: {
                provider: { type: 'string' },
                embedUrl: { type: 'string' },
                iframeCode: { type: 'string' }
              }
            }
          }
        },
        401: {
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
      const { provider, id } = request.params as { provider: string; id: string };
      
      const sanitizedProvider = sanitizeId(provider);
      const sanitizedId = sanitizeId(id);
      
      if (!sanitizedProvider || !sanitizedId) {
        throw new ValidationError('Invalid provider or ID format');
      }

      const embedData = await providerService.getProviderEmbedUrl(sanitizedProvider, sanitizedId);
      return { success: true, data: embedData };
    } catch (error) {
      logErrorWithDetails(error, {
        context: 'Get provider embed URL',
        provider: (request.params as any).provider,
        id: (request.params as any).id
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Get supported providers list - requires internal authentication
  fastify.get('/list', { 
    preHandler: [internalAuth],
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
                required: ['id', 'name', 'baseUrl', 'enabled', 'iframeTemplate'],
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  baseUrl: { type: 'string' },
                  iframeTemplate: { type: 'string' },
                  enabled: { type: 'boolean' },
                  healthCheckUrl: { type: 'string' },
                  rateLimit: {
                    type: 'object',
                    properties: {
                      requests: { type: 'number' },
                      windowMs: { type: 'number' }
                    }
                  },
                }
              }
            }
          }
        },
        401: {
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
      const providers = await providerService.getSupportedProviders();
      return { success: true, data: providers };
    } catch (error) {
      logErrorWithDetails(error, { context: 'Get providers list' });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });


  // Get provider statistics - requires internal authentication
  fastify.get('/stats', { 
    preHandler: [internalAuth],
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
                totalProviders: { type: 'number' },
                enabledProviders: { type: 'number' },
                disabledProviders: { type: 'number' },
                providers: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      enabled: { type: 'boolean' },
                      rateLimit: {
                        type: 'object',
                        properties: {
                          requests: { type: 'number' },
                          windowMs: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
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
      const stats = await providerService.getProviderStats();
      return { success: true, data: stats };
    } catch (error) {
      logErrorWithDetails(error, { context: 'Get provider statistics' });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

};

export default providersRoutes;
import { FastifyPluginAsync } from 'fastify';
import { providerService } from '../services/providerService';
import { proxyService } from '../services/proxyService';
import { internalAuth } from '../middleware/internalAuth';
import { sanitizeId, sanitizeString } from '../utils/sanitizer';
import { createSafeErrorResponse, logErrorWithDetails } from '../utils/errorHandler';

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
        return reply.code(400 as any).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid provider or ID format'
        });
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
                  proxyRequired: { type: 'boolean' }
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

  // Check provider health - requires internal authentication
  fastify.get('/:provider/status', { 
    preHandler: [internalAuth],
    schema: {
      params: {
        type: 'object',
        required: ['provider'],
        properties: {
          provider: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' }
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
              required: ['provider', 'status', 'lastChecked'],
              properties: {
                provider: { type: 'string' },
                status: { type: 'string', enum: ['healthy', 'unhealthy', 'unknown'] },
                lastChecked: { type: 'string', format: 'date-time' },
                responseTime: { type: 'number' },
                error: { type: 'string' }
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
      const { provider } = request.params as { provider: string };
      
      const sanitizedProvider = sanitizeId(provider);
      if (!sanitizedProvider) {
        return reply.code(400 as any).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid provider format'
        });
      }

      const healthStatus = await providerService.getProviderStatus(sanitizedProvider);
      return { success: true, data: healthStatus };
    } catch (error) {
      logErrorWithDetails(error, { 
        context: 'Check provider health',
        provider: (request.params as any).provider
      });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });

  // Check all providers health - requires internal authentication
  fastify.get('/status/all', { 
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
                required: ['provider', 'status', 'lastChecked'],
                properties: {
                  provider: { type: 'string' },
                  status: { type: 'string', enum: ['healthy', 'unhealthy', 'unknown'] },
                  lastChecked: { type: 'string', format: 'date-time' },
                  responseTime: { type: 'number' },
                  error: { type: 'string' }
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
      const healthStatuses = await providerService.checkAllProvidersHealth();
      return { success: true, data: healthStatuses };
    } catch (error) {
      logErrorWithDetails(error, { context: 'Check all providers health' });
      
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
                providersRequiringProxy: { type: 'number' },
                providers: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      enabled: { type: 'boolean' },
                      proxyRequired: { type: 'boolean' },
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

  // Get proxy statistics - requires internal authentication
  fastify.get('/proxy/stats', { 
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
                totalProxies: { type: 'number' },
                enabledProxies: { type: 'number' },
                disabledProxies: { type: 'number' },
                averageSuccessRate: { type: 'number' },
                proxies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      url: { type: 'string' },
                      enabled: { type: 'boolean' },
                      lastUsed: { type: 'string', format: 'date-time' },
                      requestCount: { type: 'number' },
                      successRate: { type: 'number' }
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
      const stats = await proxyService.getProxyStats();
      return { success: true, data: stats };
    } catch (error) {
      logErrorWithDetails(error, { context: 'Get proxy statistics' });
      
      const safeError = createSafeErrorResponse(error);
      return reply.code(safeError.statusCode as any).send(safeError);
    }
  });
};

export default providersRoutes;
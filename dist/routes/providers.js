"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const providerService_1 = require("../services/providerService");
const proxyService_1 = require("../services/proxyService");
const internalAuth_1 = require("../middleware/internalAuth");
const sanitizer_1 = require("../utils/sanitizer");
const errorHandler_1 = require("../utils/errorHandler");
const providersRoutes = async (fastify) => {
    fastify.get('/:provider/:id', {
        preHandler: [internalAuth_1.internalAuth],
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
            const { provider, id } = request.params;
            const sanitizedProvider = (0, sanitizer_1.sanitizeId)(provider);
            const sanitizedId = (0, sanitizer_1.sanitizeId)(id);
            if (!sanitizedProvider || !sanitizedId) {
                return reply.code(400).send({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'Invalid provider or ID format'
                });
            }
            const embedData = await providerService_1.providerService.getProviderEmbedUrl(sanitizedProvider, sanitizedId);
            return { success: true, data: embedData };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, {
                context: 'Get provider embed URL',
                provider: request.params.provider,
                id: request.params.id
            });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
    fastify.get('/list', {
        preHandler: [internalAuth_1.internalAuth],
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
            const providers = await providerService_1.providerService.getSupportedProviders();
            return { success: true, data: providers };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, { context: 'Get providers list' });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
    fastify.get('/:provider/status', {
        preHandler: [internalAuth_1.internalAuth],
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
            const { provider } = request.params;
            const sanitizedProvider = (0, sanitizer_1.sanitizeId)(provider);
            if (!sanitizedProvider) {
                return reply.code(400).send({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'Invalid provider format'
                });
            }
            const healthStatus = await providerService_1.providerService.getProviderStatus(sanitizedProvider);
            return { success: true, data: healthStatus };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, {
                context: 'Check provider health',
                provider: request.params.provider
            });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
    fastify.get('/status/all', {
        preHandler: [internalAuth_1.internalAuth],
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
            const healthStatuses = await providerService_1.providerService.checkAllProvidersHealth();
            return { success: true, data: healthStatuses };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, { context: 'Check all providers health' });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
    fastify.get('/stats', {
        preHandler: [internalAuth_1.internalAuth],
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
            const stats = await providerService_1.providerService.getProviderStats();
            return { success: true, data: stats };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, { context: 'Get provider statistics' });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
    fastify.get('/proxy/stats', {
        preHandler: [internalAuth_1.internalAuth],
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
            const stats = await proxyService_1.proxyService.getProxyStats();
            return { success: true, data: stats };
        }
        catch (error) {
            (0, errorHandler_1.logErrorWithDetails)(error, { context: 'Get proxy statistics' });
            const safeError = (0, errorHandler_1.createSafeErrorResponse)(error);
            return reply.code(safeError.statusCode).send(safeError);
        }
    });
};
exports.default = providersRoutes;
//# sourceMappingURL=providers.js.map
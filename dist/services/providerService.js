"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerService = exports.ProviderService = void 0;
const axios_1 = __importDefault(require("axios"));
const redis_1 = require("../config/redis");
class ProviderService {
    constructor() {
        this.providers = [
            {
                id: 'vidnest',
                name: 'VidNest',
                baseUrl: 'https://vidnest.fun',
                iframeTemplate: '<iframe src="https://vidnest.fun/movie/{id}" frameBorder="0" scrolling="no" allowFullScreen></iframe>',
                enabled: true,
                healthCheckUrl: 'https://vidnest.fun',
                rateLimit: { requests: 10, windowMs: 60000 },
                proxyRequired: true
            },
            {
                id: 'vidsrc',
                name: 'VidSrc',
                baseUrl: 'https://vidsrc.to',
                iframeTemplate: '<iframe src="https://vidsrc.to/embed-{id}" frameBorder="0" scrolling="no" allowFullScreen></iframe>',
                enabled: true,
                healthCheckUrl: 'https://vidsrc.to',
                rateLimit: { requests: 15, windowMs: 60000 },
                proxyRequired: true
            },
            {
                id: 'embed',
                name: 'EmbedStream',
                baseUrl: 'https://embed.stream',
                iframeTemplate: '<iframe src="https://embed.stream/embed/{id}" frameBorder="0" scrolling="no" allowFullScreen></iframe>',
                enabled: true,
                healthCheckUrl: 'https://embed.stream',
                rateLimit: { requests: 20, windowMs: 60000 },
                proxyRequired: false
            }
        ];
    }
    async getProviderEmbedUrl(providerId, mediaId) {
        const cacheKey = `${providerId}:${mediaId}`;
        const cached = await (0, redis_1.getProviderCache)('embed', cacheKey);
        if (cached) {
            return cached;
        }
        const provider = this.providers.find(p => p.id === providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }
        if (!provider.enabled) {
            throw new Error(`Provider ${providerId} is disabled`);
        }
        const embedUrl = `${provider.baseUrl}/movie/${mediaId}`;
        const iframeCode = provider.iframeTemplate.replace('{id}', mediaId);
        const result = {
            provider: providerId,
            embedUrl,
            iframeCode,
            success: true
        };
        await (0, redis_1.setProviderCache)('embed', cacheKey, result, 21600);
        return result;
    }
    async getSupportedProviders() {
        return this.providers.filter(p => p.enabled);
    }
    async checkProviderHealth(providerId) {
        const provider = this.providers.find(p => p.id === providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }
        const startTime = Date.now();
        let status = 'unknown';
        let responseTime;
        let error;
        try {
            if (!provider.healthCheckUrl) {
                throw new Error('No health check URL configured');
            }
            const response = await axios_1.default.get(provider.healthCheckUrl, {
                timeout: 10000,
                validateStatus: (status) => status < 500
            });
            responseTime = Date.now() - startTime;
            if (response.status >= 200 && response.status < 300) {
                status = 'healthy';
            }
            else {
                status = 'unhealthy';
                error = `HTTP ${response.status}`;
            }
        }
        catch (err) {
            responseTime = Date.now() - startTime;
            status = 'unhealthy';
            error = err instanceof Error ? err.message : 'Unknown error';
        }
        const healthStatus = {
            provider: providerId,
            status,
            lastChecked: new Date(),
            responseTime,
            error: error || undefined
        };
        await (0, redis_1.setProviderCache)('health', providerId, healthStatus, 300);
        return healthStatus;
    }
    async checkAllProvidersHealth() {
        const healthChecks = this.providers.map(provider => this.checkProviderHealth(provider.id));
        return Promise.all(healthChecks);
    }
    async getProviderStatus(providerId) {
        const cached = await (0, redis_1.getProviderCache)('health', providerId);
        if (cached) {
            return cached;
        }
        return this.checkProviderHealth(providerId);
    }
    async getProviderStats() {
        const stats = {
            totalProviders: this.providers.length,
            enabledProviders: this.providers.filter(p => p.enabled).length,
            disabledProviders: this.providers.filter(p => !p.enabled).length,
            providersRequiringProxy: this.providers.filter(p => p.proxyRequired).length,
            providers: this.providers.map(p => ({
                id: p.id,
                name: p.name,
                enabled: p.enabled,
                proxyRequired: p.proxyRequired,
                rateLimit: p.rateLimit
            }))
        };
        return stats;
    }
}
exports.ProviderService = ProviderService;
exports.providerService = new ProviderService();
//# sourceMappingURL=providerService.js.map
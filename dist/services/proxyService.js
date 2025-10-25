"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyService = exports.ProxyService = void 0;
const axios_1 = __importDefault(require("axios"));
const redis_1 = require("../config/redis");
class ProxyService {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.rotationInterval = null;
        this.initializeProxies();
    }
    initializeProxies() {
        const proxyUrls = process.env.PROXY_URLS?.split(',') || [
            'http://proxy1.example.com:8080',
            'http://proxy2.example.com:8080',
            'http://proxy3.example.com:8080'
        ];
        this.proxies = proxyUrls.map((url, index) => ({
            url,
            enabled: true,
            lastUsed: new Date(Date.now() - index * 60000),
            requestCount: 0,
            successRate: 100,
            healthCheckUrl: `${url}/health`
        }));
        this.startProxyRotation();
    }
    async getProxy() {
        const availableProxies = this.proxies.filter(p => p.enabled);
        if (availableProxies.length === 0) {
            return null;
        }
        const proxy = availableProxies[this.currentIndex % availableProxies.length];
        this.currentIndex++;
        if (proxy) {
            proxy.lastUsed = new Date();
            proxy.requestCount++;
        }
        return proxy || null;
    }
    async checkProxyHealth(proxyUrl) {
        const startTime = Date.now();
        let status = 'unknown';
        let responseTime;
        let error;
        try {
            const proxy = this.proxies.find(p => p.url === proxyUrl);
            if (!proxy) {
                throw new Error('Proxy not found');
            }
            const healthCheckUrl = proxy.healthCheckUrl || proxyUrl;
            const response = await axios_1.default.get(healthCheckUrl, {
                timeout: 10000,
                proxy: {
                    host: new URL(proxyUrl).hostname,
                    port: parseInt(new URL(proxyUrl).port) || 8080
                },
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
            proxyUrl,
            status,
            lastChecked: new Date(),
            responseTime,
            error: error || undefined,
            successRate: status === 'healthy' ? 100 : 0
        };
        await (0, redis_1.setProxyHealth)(proxyUrl, status === 'healthy');
        return healthStatus;
    }
    async checkAllProxiesHealth() {
        const healthChecks = this.proxies.map(proxy => this.checkProxyHealth(proxy.url));
        return Promise.all(healthChecks);
    }
    async disableProxy(proxyUrl) {
        const proxy = this.proxies.find(p => p.url === proxyUrl);
        if (proxy) {
            proxy.enabled = false;
            console.log(`Proxy ${proxyUrl} disabled`);
        }
    }
    async enableProxy(proxyUrl) {
        const proxy = this.proxies.find(p => p.url === proxyUrl);
        if (proxy) {
            proxy.enabled = true;
            console.log(`Proxy ${proxyUrl} enabled`);
        }
    }
    async getProxyStats() {
        const totalProxies = this.proxies.length;
        const enabledProxies = this.proxies.filter(p => p.enabled).length;
        const disabledProxies = totalProxies - enabledProxies;
        const avgSuccessRate = this.proxies.reduce((sum, p) => sum + p.successRate, 0) / totalProxies;
        return {
            totalProxies,
            enabledProxies,
            disabledProxies,
            averageSuccessRate: Math.round(avgSuccessRate * 100) / 100,
            proxies: this.proxies.map(p => ({
                url: p.url,
                enabled: p.enabled,
                lastUsed: p.lastUsed,
                requestCount: p.requestCount,
                successRate: p.successRate
            }))
        };
    }
    startProxyRotation() {
        const rotationInterval = parseInt(process.env.PROXY_ROTATION_INTERVAL || '300000');
        this.rotationInterval = setInterval(async () => {
            console.log('Performing proxy health check...');
            const healthStatuses = await this.checkAllProxiesHealth();
            healthStatuses.forEach(status => {
                if (status.status === 'unhealthy') {
                    console.warn(`Proxy ${status.proxyUrl} is unhealthy: ${status.error}`);
                    this.disableProxy(status.proxyUrl);
                }
            });
            const disabledProxies = this.proxies.filter(p => !p.enabled);
            if (disabledProxies.length > 0) {
                console.log(`Re-checking ${disabledProxies.length} disabled proxies...`);
                disabledProxies.forEach(proxy => {
                    this.enableProxy(proxy.url);
                });
            }
        }, rotationInterval);
    }
    async addProxy(proxyUrl) {
        if (this.proxies.some(p => p.url === proxyUrl)) {
            throw new Error('Proxy already exists');
        }
        this.proxies.push({
            url: proxyUrl,
            enabled: true,
            lastUsed: new Date(),
            requestCount: 0,
            successRate: 100,
            healthCheckUrl: `${proxyUrl}/health`
        });
        console.log(`Added new proxy: ${proxyUrl}`);
    }
    async removeProxy(proxyUrl) {
        const index = this.proxies.findIndex(p => p.url === proxyUrl);
        if (index === -1) {
            throw new Error('Proxy not found');
        }
        this.proxies.splice(index, 1);
        console.log(`Removed proxy: ${proxyUrl}`);
    }
    async cleanup() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
        }
    }
}
exports.ProxyService = ProxyService;
exports.proxyService = new ProxyService();
//# sourceMappingURL=proxyService.js.map
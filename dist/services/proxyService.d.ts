import { ProxyConfig, ProxyHealthStatus } from '../types';
export declare class ProxyService {
    private proxies;
    private currentIndex;
    private rotationInterval;
    constructor();
    private initializeProxies;
    getProxy(): Promise<ProxyConfig | null>;
    checkProxyHealth(proxyUrl: string): Promise<ProxyHealthStatus>;
    checkAllProxiesHealth(): Promise<ProxyHealthStatus[]>;
    disableProxy(proxyUrl: string): Promise<void>;
    enableProxy(proxyUrl: string): Promise<void>;
    getProxyStats(): Promise<any>;
    private startProxyRotation;
    addProxy(proxyUrl: string): Promise<void>;
    removeProxy(proxyUrl: string): Promise<void>;
    cleanup(): Promise<void>;
}
export declare const proxyService: ProxyService;
//# sourceMappingURL=proxyService.d.ts.map
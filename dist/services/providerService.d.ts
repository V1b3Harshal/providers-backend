import { Provider, ProviderEmbedUrl, ProviderHealthStatus } from '../types';
export declare class ProviderService {
    private providers;
    getProviderEmbedUrl(providerId: string, mediaId: string): Promise<ProviderEmbedUrl>;
    getSupportedProviders(): Promise<Provider[]>;
    checkProviderHealth(providerId: string): Promise<ProviderHealthStatus>;
    checkAllProvidersHealth(): Promise<ProviderHealthStatus[]>;
    getProviderStatus(providerId: string): Promise<ProviderHealthStatus>;
    getProviderStats(): Promise<any>;
}
export declare const providerService: ProviderService;
//# sourceMappingURL=providerService.d.ts.map
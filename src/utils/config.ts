// Enhanced configuration management with validation
import { env } from 'process';
import { logger } from './logger';

export interface ConfigValidation {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'url';
  validator?: (value: any) => boolean;
  default?: any;
  description: string;
}

export interface AppConfig {
  // Server config
  port: number;
  host: string;
  env: string;
  
  // Security
  internalApiKey: string;
  jwtSecret: string;
  sessionTimeout: number;
  
  // Database & Cache
  redisUrl: string;
  redisPassword?: string | null;
  
  // Rate limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  
  // External services
  tmdbApiKey: string;
  traktApiUrl: string;
  traktClientId: string;
  traktClientSecret: string;
  
  // CORS
  corsOrigin: string;
  
  // WebSocket
  wsPort: number;
  wsMaxConnections: number;
  
  // Provider settings
  providerConfig: {
    vidnest: {
      baseUrl: string;
      enabled: boolean;
    };
  };
  
  // Monitoring
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  healthcheckUrl?: string | null;
}

class ConfigManager {
  private config: AppConfig | null = null;
  
  constructor() {
    this.validateAndLoadConfig();
  }

  private validateAndLoadConfig(): void {
    const validationRules: ConfigValidation[] = [
      // Required strings
      { name: 'INTERNAL_API_KEY', required: true, type: 'string', description: 'Internal API authentication key' },
      { name: 'JWT_SECRET', required: true, type: 'string', description: 'JWT signing secret' },
      { name: 'TMDB_API_KEY', required: true, type: 'string', description: 'The Movie Database API key' },
      { name: 'REDIS_URL', required: true, type: 'url', description: 'Redis connection URL' },
      
      // Optional strings with defaults
      { name: 'CORS_ORIGIN', required: false, type: 'string', default: 'http://localhost:3000', description: 'CORS origin' },
      { name: 'VIDNEST_BASE_URL', required: false, type: 'string', default: 'https://vidnest.fun', description: 'Vidnest provider base URL' },
      { name: 'LOG_LEVEL', required: false, type: 'string', default: 'info', description: 'Logging level' },
      { name: 'TRAKT_API_URL', required: false, type: 'string', default: 'https://api.trakt.tv', description: 'Trakt API URL' },
      
      // Numbers
      { name: 'PORT', required: false, type: 'number', default: 3001, description: 'Server port' },
      { name: 'WS_PORT', required: false, type: 'number', default: 3002, description: 'WebSocket port' },
      { name: 'RATE_LIMIT_WINDOW_MS', required: false, type: 'number', default: 60000, description: 'Rate limit window' },
      { name: 'RATE_LIMIT_MAX_REQUESTS', required: false, type: 'number', default: 100, description: 'Rate limit max requests' },
      { name: 'SESSION_TIMEOUT_MS', required: false, type: 'number', default: 1800000, description: 'Session timeout' },
      { name: 'WS_MAX_CONNECTIONS', required: false, type: 'number', default: 1000, description: 'WebSocket max connections' },
      
      // Booleans
      { name: 'NODE_ENV', required: false, type: 'string', default: 'development', description: 'Environment' }
    ];

    const errors: string[] = [];
    const config: any = {};

    for (const rule of validationRules) {
      const value = env[rule.name];
      
      // Check if required
      if (rule.required && (!value || value.trim() === '')) {
        errors.push(`${rule.name} is required: ${rule.description}`);
        continue;
      }

      // Use default if not provided
      const finalValue = value !== undefined ? value : rule.default;
      
      if (finalValue === undefined) {
        continue; // Skip optional fields without defaults
      }

      // Type validation and conversion
      try {
        switch (rule.type) {
          case 'string':
            config[rule.name.toLowerCase()] = String(finalValue);
            break;
          case 'number':
            const num = Number(finalValue);
            if (isNaN(num)) {
              errors.push(`${rule.name} must be a number, got: ${finalValue}`);
              continue;
            }
            config[rule.name.toLowerCase()] = num;
            break;
          case 'boolean':
            config[rule.name.toLowerCase()] = finalValue === 'true' || finalValue === true;
            break;
          case 'url':
            try {
              new URL(String(finalValue));
              config[rule.name.toLowerCase()] = String(finalValue);
            } catch {
              errors.push(`${rule.name} must be a valid URL, got: ${finalValue}`);
              continue;
            }
            break;
        }
      } catch (error) {
        errors.push(`${rule.name} validation failed: ${error}`);
      }
    }

    // Additional security validations
    if (config.jwt_secret && config.jwt_secret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }

    if (config.internal_api_key && config.internal_api_key === 'your-secure-internal-api-key-here') {
      errors.push('INTERNAL_API_KEY cannot be the default placeholder value');
    }

    if (errors.length > 0) {
      logger.error('Configuration validation failed:', errors);
      throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }

    // Build the final configuration object
    const configData: AppConfig = {
      // Server config
      port: config.port,
      host: '0.0.0.0',
      env: config.node_env,
      
      // Security
      internalApiKey: config.internal_api_key,
      jwtSecret: config.jwt_secret,
      sessionTimeout: config.session_timeout,
      
      // Database & Cache
      redisUrl: config.redis_url,
      redisPassword: env.REDIS_PASSWORD || null,
      
      // Rate limiting
      rateLimit: {
        windowMs: config.rate_limit_window,
        maxRequests: config.rate_limit_max_requests,
      },
      
      // External services
      tmdbApiKey: config.tmdn_api_key,
      traktApiUrl: config.trakt_api_url,
      traktClientId: config.trakt_client_id,
      traktClientSecret: config.trakt_client_secret,
      
      // CORS
      corsOrigin: config.cors_origin,
      
      // WebSocket
      wsPort: config.ws_port,
      wsMaxConnections: config.ws_max_connections,
      
      // Provider settings
      providerConfig: {
        vidnest: {
          baseUrl: config.vidnest_base_url,
          enabled: true,
        }
      },
      
      // Monitoring
      logLevel: config.log_level as 'error' | 'warn' | 'info' | 'debug',
      healthcheckUrl: env.HEALTHCHECKS_IO_URL || null,
    };

    this.config = configData;
    logger.info('Configuration loaded successfully');
  }

  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }

  // Helper methods
  isProduction(): boolean {
    return this.config?.env === 'production';
  }

  isDevelopment(): boolean {
    return this.config?.env === 'development';
  }

  getRedisConfig() {
    return {
      url: this.config?.redisUrl,
      password: this.config?.redisPassword
    };
  }

  getRateLimitConfig() {
    return this.config?.rateLimit;
  }
}

// Global configuration instance
export const configManager = new ConfigManager();

// Export for backward compatibility
export const appConfig = configManager.getConfig();
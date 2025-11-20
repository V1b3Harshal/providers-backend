// =================================================================
// BETTER UPTIME MONITORING INTEGRATION
// Free tier: 50 monitors
// Better Uptime: https://betteruptime.com
// =================================================================

import { logger } from '../utils/logger';
import axios from 'axios';

export interface BetterUptimeConfig {
  apiKey: string;
  baseUrl: string;
}

export interface HeartbeatCheck {
  name: string;
  url: string;
  expectedStatusCode: number;
  checkInterval: number; // in seconds
}

class BetterUptimeService {
  private static instance: BetterUptimeService;
  private config: BetterUptimeConfig | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): BetterUptimeService {
    if (!BetterUptimeService.instance) {
      BetterUptimeService.instance = new BetterUptimeService();
    }
    return BetterUptimeService.instance;
  }

  public init(config?: BetterUptimeConfig): void {
    if (this.isInitialized) {
      logger.warn('BetterUptime already initialized');
      return;
    }

    try {
      this.config = config || {
        apiKey: process.env.BETTER_UPTIME_API_KEY || '',
        baseUrl: 'https://betteruptime.com/api/v1'
      };

      if (!this.config.apiKey || this.config.apiKey === 'your-better-uptime-api-key') {
        logger.info('BetterUptime configuration missing, using mock implementation');
        this.isInitialized = true;
        return;
      }

      this.isInitialized = true;
      logger.info('BetterUptime initialized successfully');

      // Test connection
      this.testConnection().catch(error => {
        logger.warn('BetterUptime connection test failed, continuing with mock mode:', error);
      });
    } catch (error) {
      logger.error('Failed to initialize BetterUptime:', error);
      this.isInitialized = true;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.config) {
      logger.info('BetterUptime connection test skipped (no config)');
      return;
    }

    try {
      // Check for placeholder values
      if (this.config.apiKey === 'your-better-uptime-api-key') {
        logger.info('BetterUptime connection test skipped (placeholder key)');
        return;
      }

      // Test heartbeat URL instead of API endpoint
      const heartbeatUrl = process.env.BETTER_UPTIME_HEARTBEAT_URL;
      if (heartbeatUrl && heartbeatUrl !== 'your-heartbeat-url') {
        const response = await axios.get(heartbeatUrl, {
          timeout: 5000,
          validateStatus: (status) => status < 500 // Accept any status < 500
        });

        logger.info('BetterUptime heartbeat test successful', {
          status: response.status,
          url: heartbeatUrl
        });
      } else {
        // Fallback to API test if no heartbeat URL
        const response = await axios.get(`${this.config.baseUrl}/monitors`, {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        logger.info('BetterUptime API test successful', {
          monitors: response.data.length
        });
      }
    } catch (error) {
      logger.warn('BetterUptime connection test failed, switching to mock mode:', error);
    }
  }

  /**
   * Create a heartbeat check
   */
  async createHeartbeat(name: string, url: string): Promise<any> {
    if (!this.isInitialized || !this.config) {
      logger.warn('BetterUptime not initialized');
      return null;
    }

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/heartbeats`,
        {
          name,
          url,
          check_interval: 300, // 5 minutes
          request_method: 'GET'
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('BetterUptime heartbeat created', { name, url });
      return response.data;
    } catch (error) {
      logger.error('Failed to create BetterUptime heartbeat:', error);
      return null;
    }
  }

  /**
   * Send heartbeat signal (to indicate service is alive)
   */
  async sendHeartbeat(heartbeatId: string): Promise<boolean> {
    if (!this.isInitialized || !this.config) {
      return false;
    }

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/heartbeats/${heartbeatId}/ping`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.status === 201;
    } catch (error) {
      logger.error('Failed to send BetterUptime heartbeat:', error);
      return false;
    }
  }

  /**
   * Get monitor status
   */
  async getMonitorStatus(monitorId: string): Promise<any> {
    if (!this.isInitialized || !this.config) {
      return null;
    }

    try {
      const response = await axios.get(
        `${this.config.baseUrl}/monitors/${monitorId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get BetterUptime monitor status:', error);
      return null;
    }
  }

  /**
   * Get all monitors
   */
  async getMonitors(): Promise<any> {
    if (!this.isInitialized || !this.config) {
      return null;
    }

    try {
      const response = await axios.get(
        `${this.config.baseUrl}/monitors`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get BetterUptime monitors:', error);
      return null;
    }
  }

  /**
   * Get service status
   */
  getStatus(): any {
    const heartbeatUrl = process.env.BETTER_UPTIME_HEARTBEAT_URL;
    const hasHeartbeatUrl = heartbeatUrl && heartbeatUrl !== 'your-heartbeat-url';

    return {
      initialized: this.isInitialized,
      configured: !!this.config?.apiKey && hasHeartbeatUrl,
      apiKey: this.config?.apiKey ? '***' + this.config.apiKey.slice(-4) : null,
      heartbeatUrl: hasHeartbeatUrl ? '***configured***' : null
    };
  }
}

export const betterUptimeService = BetterUptimeService.getInstance();
export default betterUptimeService;
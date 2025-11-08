// Audit logging for security and compliance
import { logger } from './logger';
import { getRedisClient, RedisKeys } from '../config/redis';

export interface AuditLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  userId?: string;
  ip: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  responseTime?: number;
  details?: any;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

class AuditLogger {
  private redisClient: any = null;
  
  async ensureRedisClient(): Promise<any> {
    if (this.redisClient) {
      return this.redisClient;
    }
    try {
      this.redisClient = await getRedisClient();
      return this.redisClient;
    } catch (error) {
      logger.warn('Redis not available for audit logging');
      return null;
    }
  }

  async log(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    // Always log critical events
    if (fullEntry.riskLevel === 'critical' || fullEntry.level === 'error') {
      logger.error('AUDIT', fullEntry);
    }

    // Store in Redis if available
    try {
      const client = await this.ensureRedisClient();
      if (client) {
        const key = `${RedisKeys.cache}audit:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
        await client.setEx(key, 86400, JSON.stringify(fullEntry)); // 24h retention
      }
    } catch (error) {
      logger.warn('Failed to store audit log in Redis:', error);
    }

    // Security event detection
    this.detectSecurityEvents(fullEntry);
  }

  private detectSecurityEvents(entry: AuditLogEntry): void {
    // Failed authentication attempts
    if (entry.statusCode === 401 && entry.endpoint.includes('auth')) {
      logger.warn('Potential brute force attack detected', {
        ip: entry.ip,
        endpoint: entry.endpoint,
        userAgent: entry.userAgent
      });
    }

    // Rate limit violations
    if (entry.statusCode === 429) {
      logger.warn('Rate limit exceeded', {
        ip: entry.ip,
        endpoint: entry.endpoint
      });
    }

    // Suspicious endpoints
    if (entry.endpoint.includes('../') || entry.endpoint.includes('..\\')) {
      logger.error('Path traversal attempt detected', {
        ip: entry.ip,
        endpoint: entry.endpoint,
        userAgent: entry.userAgent
      });
    }
  }

  // Middleware for automatic request logging
  middleware() {
    return async (request: any, reply: any, done: Function) => {
      const startTime = Date.now();
      const originalSend = reply.send;
      
      // Override send to capture response
      reply.send = function(data: any) {
        const responseTime = Date.now() - startTime;
        
        // Log the request
        auditLogger.log({
          level: 'info',
          event: 'http_request',
          ip: request.ip || 'unknown',
          userAgent: request.headers['user-agent'],
          endpoint: request.url,
          method: request.method,
          statusCode: reply.statusCode,
          responseTime,
          details: {
            query: request.query,
            params: request.params
          },
          riskLevel: reply.statusCode >= 500 ? 'high' : 'low'
        });

        return originalSend.call(this, data);
      };

      done();
    };
  }
}

export const auditLogger = new AuditLogger();

// Security event types
export const SecurityEvents = {
  FAILED_AUTH: 'failed_authentication',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  SUSPICIOUS_REQUEST: 'suspicious_request',
  SYSTEM_ERROR: 'system_error'
} as const;

// Quick logging methods
export const logSecurityEvent = (event: keyof typeof SecurityEvents, details: any, riskLevel: AuditLogEntry['riskLevel'] = 'medium') => {
  return auditLogger.log({
    level: 'warn',
    event: SecurityEvents[event],
    ip: details.ip || 'unknown',
    userAgent: details.userAgent,
    endpoint: details.endpoint || 'unknown',
    method: details.method || 'unknown',
    details,
    riskLevel
  });
};
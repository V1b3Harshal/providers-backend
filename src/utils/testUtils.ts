// Testing utilities and test data generators  
import { FastifyInstance } from 'fastify';
import { ProviderConfig } from '../services/providerService';

export interface TestData {
  [key: string]: any;
}

class TestDataGenerator {
  // Generate random test provider
  static generateTestProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    const id = `test-provider-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    return {
      id,
      name: `Test Provider ${id}`,
      baseUrl: `https://test-provider-${id}.example.com`,
      enabled: true,
      iframeTemplate: '<iframe src="{embedUrl}" frameBorder="0" allowFullScreen></iframe>',
      healthCheckUrl: `https://test-provider-${id}.example.com/health`,
      rateLimit: {
        requests: 100,
        windowMs: 60000
      },
      ...overrides
    };
  }

  // Generate test media IDs
  static generateTestMediaId(): string {
    return `test-media-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  // Generate test API keys
  static generateTestApiKey(): string {
    return `test-key-${Date.now()}-${Math.random().toString(36).substring(2, 18)}`;
  }

  // Generate test user data
  static generateTestUser(overrides: any = {}): any {
    return {
      id: `test-user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      email: `test${Date.now()}@example.com`,
      name: `Test User ${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...overrides
    };
  }

  // Generate test request headers
  static generateTestHeaders(overrides: any = {}): any {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'Test-Client/1.0',
      ...overrides
    };
  }
}

class TestHelpers {
  // Wait for condition
  static async waitFor(condition: () => boolean, timeout: number = 5000): Promise<void> {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > timeout) {
        throw new Error(`Condition not met within ${timeout}ms`);
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // Test endpoint health - simplified for TypeScript compatibility
  static async testEndpointHealth(
    fastify: FastifyInstance, 
    method: string, 
    url: string,
    expectedStatus: number = 200
  ): Promise<any> {
    const response = await (fastify as any).inject({
      method: method.toUpperCase(),
      url,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.statusCode !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.statusCode}`);
    }

    return response.json();
  }

  // Test authenticated endpoint
  static async testAuthenticatedEndpoint(
    fastify: FastifyInstance,
    method: string,
    url: string,
    apiKey: string,
    expectedStatus: number = 200
  ): Promise<any> {
    const response = await (fastify as any).inject({
      method: method.toUpperCase(),
      url,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': apiKey
      }
    });

    if (response.statusCode !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.statusCode}. Response: ${response.body}`);
    }

    return response.json();
  }

  // Validate response structure
  static validateResponseStructure(response: any, expectedStructure: any): void {
    const checkStructure = (actual: any, expected: any, path: string = ''): void => {
      for (const key in expected) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (!(key in actual)) {
          throw new Error(`Missing property: ${currentPath}`);
        }
        
        if (typeof expected[key] === 'object' && expected[key] !== null && !Array.isArray(expected[key])) {
          if (typeof actual[key] !== 'object' || actual[key] === null) {
            throw new Error(`Expected object at ${currentPath}, got ${typeof actual[key]}`);
          }
          checkStructure(actual[key], expected[key], currentPath);
        }
      }
    };

    checkStructure(response, expectedStructure);
  }

  // Performance test helper
  static async performanceTest(
    testFn: () => Promise<any>,
    iterations: number = 100
  ): Promise<{ average: number; min: number; max: number; p95: number }> {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await testFn();
      times.push(Date.now() - start);
    }
    
    times.sort((a, b) => a - b);
    
    if (times.length === 0) {
      throw new Error('No performance data collected');
    }
    
    // Type safety for array access
    const min = times[0] || 0;
    const max = times[times.length - 1] || 0;
    const p95Index = Math.floor(times.length * 0.95);
    const p95 = times[p95Index] || max;
    
    return {
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min,
      max,
      p95
    };
  }

  // Memory test helper
  static async memoryTest(testFn: () => Promise<any>, iterations: number = 50): Promise<void> {
    const initialMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < iterations; i++) {
      await testFn();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    if (memoryIncrease > 10 * 1024 * 1024) { // 10MB threshold
      throw new Error(`Memory leak detected: ${memoryIncrease} bytes increase`);
    }
  }
}

class MockServices {
  // Mock Redis client
  static createMockRedisClient() {
    return {
      get: async () => ({ result: null }),
      set: async () => ({ result: 'OK' }),
      setEx: async () => ({ result: 'OK' }),
      del: async () => ({ result: 1 }),
      zAdd: async () => ({ result: 1 }),
      zRemRangeByScore: async () => ({ result: 0 }),
      zCard: async () => ({ result: 0 }),
      expire: async () => ({ result: 1 }),
      sAdd: async () => ({ result: 1 }),
      sRem: async () => ({ result: 1 }),
      sMembers: async () => ({ result: [] }),
      hGetAll: async () => ({ result: {} }),
      hSet: async () => ({ result: 1 }),
      isRedisConnected: () => true,
      getRedisUrl: () => 'mock://localhost:6379',
      getRedisToken: () => ''
    };
  }
}

class TestFixtures {
  // Create temporary test files
  static createTempFile(content: string, extension: string = '.json'): string {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    
    const tempFile = path.join(os.tmpdir(), `test-${Date.now()}${extension}`);
    fs.writeFileSync(tempFile, content);
    
    return tempFile;
  }

  // Clean up temporary files
  static cleanupTempFiles(filePaths: string[]): void {
    const fs = require('fs');
    filePaths.forEach(filePath => {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  }
}

// Export all test utilities
export {
  TestDataGenerator,
  TestHelpers,
  MockServices,
  TestFixtures
};

export default {
  TestDataGenerator,
  TestHelpers,
  MockServices,
  TestFixtures
};
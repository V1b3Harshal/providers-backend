import { logger } from '../utils/logger';

enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening circuit
  recoveryTimeout: number;     // Time to wait before trying half-open (ms)
  monitoringPeriod: number;    // Time window to count failures (ms)
  successThreshold: number;    // Successes needed to close circuit from half-open
}

interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  totalRequests: number;
  totalFailures: number;
}

class CircuitBreakerService {
  private static instance: CircuitBreakerService;
  private circuits = new Map<string, CircuitStats>();
  private config: CircuitBreakerConfig;

  constructor() {
    // Free-tier friendly configuration
    this.config = {
      failureThreshold: 5,      // Open after 5 failures
      recoveryTimeout: 30000,   // Wait 30 seconds before testing
      monitoringPeriod: 60000,  // Count failures in 1 minute window
      successThreshold: 3       // Need 3 successes to close circuit
    };

    // Periodic cleanup of old circuit data
    setInterval(() => this.cleanupOldCircuits(), 300000); // 5 minutes
  }

  public static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService.instance) {
      CircuitBreakerService.instance = new CircuitBreakerService();
    }
    return CircuitBreakerService.instance;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => T
  ): Promise<T> {
    const circuit = this.getCircuitStats(serviceName);
    const state = this.getCircuitState(circuit, serviceName);

    // Circuit is OPEN - fail fast
    if (state === CircuitState.OPEN) {
      logger.warn(`Circuit breaker OPEN for ${serviceName}, failing fast`);
      if (fallback) {
        return fallback();
      }
      throw new Error(`Circuit breaker is OPEN for service: ${serviceName}`);
    }

    // Circuit is HALF_OPEN or CLOSED - allow request
    try {
      const result = await operation();
      this.recordSuccess(serviceName, circuit);
      return result;
    } catch (error) {
      this.recordFailure(serviceName, circuit);
      logger.warn(`Circuit breaker failure recorded for ${serviceName}:`, error instanceof Error ? error.message : String(error));

      // If circuit just opened, try fallback
      if (fallback && this.getCircuitState(circuit, serviceName) === CircuitState.OPEN) {
        return fallback();
      }

      throw error;
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(serviceName?: string): { [key: string]: CircuitStats } {
    if (serviceName) {
      const circuit = this.circuits.get(serviceName);
      return circuit ? { [serviceName]: circuit } : {};
    }

    const stats: { [key: string]: CircuitStats } = {};
    for (const [name, circuit] of this.circuits.entries()) {
      stats[name] = circuit;
    }
    return stats;
  }

  /**
   * Manually reset a circuit breaker
   */
  resetCircuit(serviceName: string): void {
    this.circuits.delete(serviceName);
    logger.info(`Circuit breaker reset for service: ${serviceName}`);
  }

  /**
   * Force open a circuit (for testing)
   */
  forceOpen(serviceName: string): void {
    const circuit = this.getCircuitStats(serviceName);
    circuit.state = CircuitState.OPEN;
    circuit.lastFailureTime = Date.now();
    logger.warn(`Circuit breaker FORCE OPEN for service: ${serviceName}`);
  }

  private getCircuitStats(serviceName: string): CircuitStats {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
        totalRequests: 0,
        totalFailures: 0
      });
    }
    return this.circuits.get(serviceName)!;
  }

  private getCircuitState(circuit: CircuitStats, serviceName: string): CircuitState {
    const now = Date.now();

    // If circuit is OPEN, check if we should transition to HALF_OPEN
    if (circuit.state === CircuitState.OPEN) {
      if (now - circuit.lastFailureTime > this.config.recoveryTimeout) {
        circuit.state = CircuitState.HALF_OPEN;
        circuit.successes = 0; // Reset success counter
        logger.info(`Circuit breaker HALF_OPEN for service: ${serviceName}`);
        return CircuitState.HALF_OPEN;
      }
      return CircuitState.OPEN;
    }

    // If circuit is HALF_OPEN and we have enough successes, close it
    if (circuit.state === CircuitState.HALF_OPEN) {
      if (circuit.successes >= this.config.successThreshold) {
        circuit.state = CircuitState.CLOSED;
        circuit.failures = 0; // Reset failure counter
        logger.info(`Circuit breaker CLOSED for service: ${serviceName}`);
        return CircuitState.CLOSED;
      }
      return CircuitState.HALF_OPEN;
    }

    // Check if we should open the circuit based on recent failures
    const recentFailures = this.getRecentFailures(circuit, now);
    if (recentFailures >= this.config.failureThreshold) {
      circuit.state = CircuitState.OPEN;
      circuit.lastFailureTime = now;
      logger.warn(`Circuit breaker OPEN for service: ${serviceName} (${recentFailures} failures)`);
      return CircuitState.OPEN;
    }

    return CircuitState.CLOSED;
  }

  private getRecentFailures(circuit: CircuitStats, now: number): number {
    // For free tier simplicity, just count all failures in monitoring period
    // In production, you'd track timestamps of individual failures
    const timeWindow = now - this.config.monitoringPeriod;
    return circuit.lastFailureTime > timeWindow ? circuit.failures : 0;
  }

  private recordSuccess(_serviceName: string, circuit: CircuitStats): void {
    circuit.successes++;
    circuit.lastSuccessTime = Date.now();
    circuit.totalRequests++;

    // Reset failure count on success
    if (circuit.state === CircuitState.CLOSED) {
      circuit.failures = Math.max(0, circuit.failures - 1);
    }
  }

  private recordFailure(_serviceName: string, circuit: CircuitStats): void {
    circuit.failures++;
    circuit.lastFailureTime = Date.now();
    circuit.totalRequests++;
    circuit.totalFailures++;
  }

  private cleanupOldCircuits(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [serviceName, circuit] of this.circuits.entries()) {
      // Remove circuits that haven't been used recently and are in CLOSED state
      if (circuit.state === CircuitState.CLOSED &&
          now - Math.max(circuit.lastFailureTime, circuit.lastSuccessTime) > maxAge) {
        this.circuits.delete(serviceName);
      }
    }
  }
}

export const circuitBreaker = CircuitBreakerService.getInstance();
export default circuitBreaker;
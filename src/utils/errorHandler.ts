import { NODE_ENV } from '../config/environment';

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: any;
}

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types for better error handling
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = 'External service error', service?: string) {
    super(message, 502);
    this.name = 'ExternalServiceError';
    this.details = { service };
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database error') {
    super(message, 500);
    this.name = 'DatabaseError';
  }
}

export class RedisError extends AppError {
  constructor(message: string = 'Redis error') {
    super(message, 500);
    this.name = 'RedisError';
  }
}

export class ProviderError extends AppError {
  constructor(message: string, provider?: string) {
    super(message, 500);
    this.name = 'ProviderError';
    this.details = { provider };
  }
}

export const createSafeErrorResponse = (error: any, statusCode: number = 500): ApiError => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      error: error.name || 'Application Error',
      message: error.message,
      details: (error as any).details
    };
  }

  if (error instanceof Error) {
    return {
      statusCode,
      error: 'Internal Server Error',
      message: NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      details: NODE_ENV === 'development' ? {
        stack: error.stack,
        originalError: error.message
      } : undefined
    };
  }

  return {
    statusCode,
    error: 'Unknown Error',
    message: 'An unknown error occurred',
    details: error
  };
};

export const logErrorWithDetails = (error: any, context: any = {}) => {
  const errorDetails = {
    timestamp: new Date().toISOString(),
    context,
    error: {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      status: error?.status,
      response: error?.response?.data,
      request: error?.config
    }
  };

  if (error instanceof Error) {
    console.error('Error occurred:', errorDetails);
  } else {
    console.error('Unknown error type:', { ...errorDetails, error });
  }
};

export const handleAsyncError = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const isOperationalError = (error: any): boolean => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

export const sanitizeError = (error: any): ApiError => {
  if (NODE_ENV === 'production') {
    return {
      statusCode: error?.statusCode || 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    };
  }

  return createSafeErrorResponse(error);
};
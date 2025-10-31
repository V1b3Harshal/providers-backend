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

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
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
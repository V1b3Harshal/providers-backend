"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeError = exports.isOperationalError = exports.handleAsyncError = exports.logErrorWithDetails = exports.createSafeErrorResponse = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const createSafeErrorResponse = (error, statusCode = 500) => {
    if (error instanceof AppError) {
        return {
            statusCode: error.statusCode,
            error: error.name || 'Application Error',
            message: error.message,
            details: error.details
        };
    }
    if (error instanceof Error) {
        return {
            statusCode,
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
            details: process.env.NODE_ENV === 'development' ? {
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
exports.createSafeErrorResponse = createSafeErrorResponse;
const logErrorWithDetails = (error, context = {}) => {
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
    }
    else {
        console.error('Unknown error type:', { ...errorDetails, error });
    }
};
exports.logErrorWithDetails = logErrorWithDetails;
const handleAsyncError = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.handleAsyncError = handleAsyncError;
const isOperationalError = (error) => {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
};
exports.isOperationalError = isOperationalError;
const sanitizeError = (error) => {
    if (process.env.NODE_ENV === 'production') {
        return {
            statusCode: error?.statusCode || 500,
            error: 'Internal Server Error',
            message: 'An unexpected error occurred'
        };
    }
    return (0, exports.createSafeErrorResponse)(error);
};
exports.sanitizeError = sanitizeError;
//# sourceMappingURL=errorHandler.js.map
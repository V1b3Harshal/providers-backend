export interface ApiError {
    statusCode: number;
    error: string;
    message: string;
    details?: any;
}
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode?: number);
}
export declare const createSafeErrorResponse: (error: any, statusCode?: number) => ApiError;
export declare const logErrorWithDetails: (error: any, context?: any) => void;
export declare const handleAsyncError: (fn: Function) => (req: any, res: any, next: any) => void;
export declare const isOperationalError: (error: any) => boolean;
export declare const sanitizeError: (error: any) => ApiError;
//# sourceMappingURL=errorHandler.d.ts.map
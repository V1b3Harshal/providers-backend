// Standardized API response format for consistency
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export const createSuccessResponse = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data,
  timestamp: new Date().toISOString()
});

export const createErrorResponse = (
  code: string, 
  message: string, 
  details?: any
): ApiResponse => ({
  success: false,
  error: { code, message, details },
  timestamp: new Date().toISOString()
});

export const createPaginatedResponse = <T>(
  data: T[], 
  page: number, 
  limit: number, 
  total: number
): ApiResponse<{
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}> => ({
  success: true,
  data: {
    items: data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1
    }
  },
  timestamp: new Date().toISOString()
});
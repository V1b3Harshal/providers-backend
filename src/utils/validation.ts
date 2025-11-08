// Enhanced validation utilities without external dependencies
import { sanitizeId, sanitizeString } from './sanitizer';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

// Common validation patterns
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MEDIA_ID_PATTERN = /^[a-zA-Z0-9]+$/;
const NUMERIC_PATTERN = /^[0-9]+$/;

// Base validation functions
const isValidPattern = (value: string, pattern: RegExp): boolean => {
  return pattern.test(value);
};

const isValidLength = (value: string, min: number, max: number): boolean => {
  return value.length >= min && value.length <= max;
};

// Validation functions
export const validateId = (id: any): ValidationResult<string> => {
  if (typeof id !== 'string') {
    return { success: false, errors: ['ID must be a string'] };
  }
  
  const sanitized = sanitizeId(id);
  if (!sanitized) {
    return { success: false, errors: ['Invalid ID format'] };
  }
  
  if (!isValidPattern(sanitized, ID_PATTERN)) {
    return { success: false, errors: ['ID contains invalid characters'] };
  }
  
  if (!isValidLength(sanitized, 1, 100)) {
    return { success: false, errors: ['ID must be between 1 and 100 characters'] };
  }
  
  return { success: true, data: sanitized };
};

export const validateMediaId = (id: any): ValidationResult<string> => {
  if (typeof id !== 'string') {
    return { success: false, errors: ['Media ID must be a string'] };
  }
  
  const sanitized = sanitizeId(id);
  if (!sanitized) {
    return { success: false, errors: ['Invalid media ID format'] };
  }
  
  if (!isValidPattern(sanitized, MEDIA_ID_PATTERN)) {
    return { success: false, errors: ['Media ID contains invalid characters'] };
  }
  
  if (!isValidLength(sanitized, 1, 20)) {
    return { success: false, errors: ['Media ID must be between 1 and 20 characters'] };
  }
  
  return { success: true, data: sanitized };
};

export const validateNumber = (value: any, min?: number, max?: number): ValidationResult<number> => {
  const num = Number(value);
  
  if (isNaN(num)) {
    return { success: false, errors: ['Value must be a number'] };
  }
  
  if (min !== undefined && num < min) {
    return { success: false, errors: [`Value must be at least ${min}`] };
  }
  
  if (max !== undefined && num > max) {
    return { success: false, errors: [`Value must be at most ${max}`] };
  }
  
  return { success: true, data: num };
};

export const validateSeason = (season: any): ValidationResult<number> => {
  return validateNumber(season, 1, 999);
};

export const validateEpisode = (episode: any): ValidationResult<number> => {
  return validateNumber(episode, 1, 999);
};

// Composite validation for TV shows
export const validateTVShow = (data: { season: any; episode: any; mediaId: any }): ValidationResult<{
  season: number;
  episode: number;
  mediaId: string;
}> => {
  const seasonResult = validateSeason(data.season);
  const episodeResult = validateEpisode(data.episode);
  const mediaIdResult = validateMediaId(data.mediaId);
  
  const allErrors = [
    ...(seasonResult.errors || []),
    ...(episodeResult.errors || []),
    ...(mediaIdResult.errors || [])
  ];
  
  if (allErrors.length > 0) {
    return { success: false, errors: allErrors };
  }
  
  return {
    success: true,
    data: {
      season: seasonResult.data!,
      episode: episodeResult.data!,
      mediaId: mediaIdResult.data!
    }
  };
};

// Validation middleware for Fastify
export const createValidationMiddleware = (validators: Array<{ param: string; validator: (value: any) => ValidationResult<any> }>) => {
  return (request: any, reply: any, done: Function) => {
    const errors: string[] = [];
    
    for (const { param, validator } of validators) {
      const value = request.params?.[param];
      const result = validator(value);
      
      if (!result.success) {
        errors.push(...(result.errors || []));
      }
    }
    
    if (errors.length > 0) {
      reply.code(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          details: errors
        },
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    done();
  };
};

// Export commonly used middleware
export const validateProviderIdMiddleware = createValidationMiddleware([
  { param: 'provider', validator: validateId }
]);

export const validateMediaIdMiddleware = createValidationMiddleware([
  { param: 'id', validator: validateMediaId }
]);

export const validateTVShowMiddleware = createValidationMiddleware([
  { param: 'season', validator: validateSeason },
  { param: 'episode', validator: validateEpisode },
  { param: 'id', validator: validateMediaId }
]);
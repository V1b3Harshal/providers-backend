
export const sanitizeString = (input: any, maxLength: number = 255): string => {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters
  let sanitized = input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .replace(/[;&|`$]/g, '') // Remove shell metacharacters
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

  // Trim whitespace
  sanitized = sanitized.trim();

  // Truncate to maxLength
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
};

export const sanitizeNumber = (input: any, min?: number, max?: number): number => {
  const num = Number(input);
  
  if (isNaN(num) || !isFinite(num)) {
    return 0;
  }

  if (min !== undefined && num < min) {
    return min;
  }

  if (max !== undefined && num > max) {
    return max;
  }

  return Math.round(num);
};

export const sanitizeBoolean = (input: any): boolean => {
  if (typeof input === 'boolean') {
    return input;
  }

  if (typeof input === 'string') {
    const lowerInput = input.toLowerCase().trim();
    return ['true', '1', 'yes', 'on'].includes(lowerInput);
  }

  if (typeof input === 'number') {
    return input !== 0;
  }

  return false;
};

export const sanitizeId = (input: any): string => {
  const sanitized = sanitizeString(input, 100);
  
  // Only allow alphanumeric characters, hyphens, and underscores
  return sanitized.replace(/[^a-zA-Z0-9_-]/g, '');
};

export const sanitizeUrl = (input: any): string => {
  const sanitized = sanitizeString(input, 2048);
  
  // Basic URL validation
  // Simple URL validation using regex
  const urlPattern = /^https?:\/\/.+\/.+$/;
  return urlPattern.test(sanitized) ? sanitized : '';
};

export const sanitizeEmail = (input: any): string => {
  const sanitized = sanitizeString(input, 254);
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
};

export const sanitizeSearchQuery = (input: any): string => {
  const sanitized = sanitizeString(input, 200);
  
  // Remove special characters but keep spaces, letters, numbers, and common punctuation
  return sanitized.replace(/[^\w\s\-.,:!?]/g, '').trim();
};

export const sanitizeDate = (input: any): Date | null => {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'string') {
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof input === 'number') {
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
};

export const sanitizeArray = (input: any, itemSanitizer?: (item: any) => any): any[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter(item => item !== null && item !== undefined)
    .map(item => itemSanitizer ? itemSanitizer(item) : item);
};

export const sanitizeObject = (input: any, schema: Record<string, (value: any) => any>): any => {
  if (typeof input !== 'object' || input === null) {
    return {};
  }

  const result: any = {};
  
  for (const [key, sanitizer] of Object.entries(schema)) {
    if (input.hasOwnProperty(key)) {
      try {
        result[key] = sanitizer(input[key]);
      } catch {
        // If sanitization fails, skip the property
      }
    }
  }

  return result;
};

export const sanitizePagination = (input: any) => {
  const page = sanitizeNumber(input.page, 1, 1000) || 1;
  const limit = sanitizeNumber(input.limit, 1, 100) || 10;
  
  return { page, limit };
};

export const sanitizeSort = (input: any, allowedFields: string[]): { field: string; direction: 'asc' | 'desc' } => {
  const field = sanitizeString(input.field, 50);
  const direction = sanitizeString(input.direction, 4).toLowerCase() === 'desc' ? 'desc' : 'asc';
  
  if (!allowedFields.includes(field)) {
    return { field: 'id', direction: 'asc' };
  }
  
  return { field, direction };
};

export const sanitizeMediaId = (input: any): string => {
  const sanitized = sanitizeString(input, 20);
  
  // Only allow alphanumeric characters
  return sanitized.replace(/[^a-zA-Z0-9]/g, '');
};

export const sanitizeRoomName = (input: any): string => {
  const sanitized = sanitizeString(input, 100);
  
  // Allow letters, numbers, spaces, and common punctuation
  return sanitized.replace(/[^\w\s\-.,!?]/g, '').trim();
};

export const sanitizeUserId = (input: any): string => {
  const sanitized = sanitizeString(input, 50);
  
  // Only allow alphanumeric characters, hyphens, and underscores
  return sanitized.replace(/[^a-zA-Z0-9_-]/g, '');
};

export const sanitizePlaybackAction = (input: any) => {
  return sanitizeObject(input, {
    type: (value) => {
      const sanitized = sanitizeString(value, 20);
      return ['play', 'pause', 'seek', 'setPlaybackRate', 'updateTime'].includes(sanitized) ? sanitized : null;
    },
    data: (value) => {
      if (typeof value !== 'object' || value === null) {
        return null;
      }
      return value;
    }
  });
};

export const sanitizeRoomData = (input: any) => {
  return sanitizeObject(input, {
    name: sanitizeRoomName,
    mediaId: sanitizeMediaId,
    mediaType: (value) => {
      const sanitized = sanitizeString(value, 10);
      return ['movie', 'tv'].includes(sanitized) ? sanitized : null;
    },
    adminId: sanitizeUserId
  });
};

export const isSafeInput = (input: any): boolean => {
  if (typeof input === 'string') {
    // Check for potential XSS or injection patterns
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:/i,
      /vbscript:/i,
      /eval\s*\(/i
    ];

    return !dangerousPatterns.some(pattern => pattern.test(input));
  }

  if (typeof input === 'object' && input !== null) {
    return Object.values(input).every(isSafeInput);
  }

  return true;
};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSafeInput = exports.sanitizeRoomData = exports.sanitizePlaybackAction = exports.sanitizeUserId = exports.sanitizeRoomName = exports.sanitizeMediaId = exports.sanitizeSort = exports.sanitizePagination = exports.sanitizeObject = exports.sanitizeArray = exports.sanitizeDate = exports.sanitizeSearchQuery = exports.sanitizeEmail = exports.sanitizeUrl = exports.sanitizeId = exports.sanitizeBoolean = exports.sanitizeNumber = exports.sanitizeString = void 0;
const sanitizeString = (input, maxLength = 255) => {
    if (typeof input !== 'string') {
        return '';
    }
    let sanitized = input
        .replace(/[<>]/g, '')
        .replace(/['"]/g, '')
        .replace(/[;&|`$]/g, '')
        .replace(/[\x00-\x1F\x7F]/g, '');
    sanitized = sanitized.trim();
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }
    return sanitized;
};
exports.sanitizeString = sanitizeString;
const sanitizeNumber = (input, min, max) => {
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
exports.sanitizeNumber = sanitizeNumber;
const sanitizeBoolean = (input) => {
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
exports.sanitizeBoolean = sanitizeBoolean;
const sanitizeId = (input) => {
    const sanitized = (0, exports.sanitizeString)(input, 100);
    return sanitized.replace(/[^a-zA-Z0-9_-]/g, '');
};
exports.sanitizeId = sanitizeId;
const sanitizeUrl = (input) => {
    const sanitized = (0, exports.sanitizeString)(input, 2048);
    const urlPattern = /^https?:\/\/.+\/.+$/;
    return urlPattern.test(sanitized) ? sanitized : '';
};
exports.sanitizeUrl = sanitizeUrl;
const sanitizeEmail = (input) => {
    const sanitized = (0, exports.sanitizeString)(input, 254);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(sanitized) ? sanitized : '';
};
exports.sanitizeEmail = sanitizeEmail;
const sanitizeSearchQuery = (input) => {
    const sanitized = (0, exports.sanitizeString)(input, 200);
    return sanitized.replace(/[^\w\s\-.,:!?]/g, '').trim();
};
exports.sanitizeSearchQuery = sanitizeSearchQuery;
const sanitizeDate = (input) => {
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
exports.sanitizeDate = sanitizeDate;
const sanitizeArray = (input, itemSanitizer) => {
    if (!Array.isArray(input)) {
        return [];
    }
    return input
        .filter(item => item !== null && item !== undefined)
        .map(item => itemSanitizer ? itemSanitizer(item) : item);
};
exports.sanitizeArray = sanitizeArray;
const sanitizeObject = (input, schema) => {
    if (typeof input !== 'object' || input === null) {
        return {};
    }
    const result = {};
    for (const [key, sanitizer] of Object.entries(schema)) {
        if (input.hasOwnProperty(key)) {
            try {
                result[key] = sanitizer(input[key]);
            }
            catch {
            }
        }
    }
    return result;
};
exports.sanitizeObject = sanitizeObject;
const sanitizePagination = (input) => {
    const page = (0, exports.sanitizeNumber)(input.page, 1, 1000) || 1;
    const limit = (0, exports.sanitizeNumber)(input.limit, 1, 100) || 10;
    return { page, limit };
};
exports.sanitizePagination = sanitizePagination;
const sanitizeSort = (input, allowedFields) => {
    const field = (0, exports.sanitizeString)(input.field, 50);
    const direction = (0, exports.sanitizeString)(input.direction, 4).toLowerCase() === 'desc' ? 'desc' : 'asc';
    if (!allowedFields.includes(field)) {
        return { field: 'id', direction: 'asc' };
    }
    return { field, direction };
};
exports.sanitizeSort = sanitizeSort;
const sanitizeMediaId = (input) => {
    const sanitized = (0, exports.sanitizeString)(input, 20);
    return sanitized.replace(/[^a-zA-Z0-9]/g, '');
};
exports.sanitizeMediaId = sanitizeMediaId;
const sanitizeRoomName = (input) => {
    const sanitized = (0, exports.sanitizeString)(input, 100);
    return sanitized.replace(/[^\w\s\-.,!?]/g, '').trim();
};
exports.sanitizeRoomName = sanitizeRoomName;
const sanitizeUserId = (input) => {
    const sanitized = (0, exports.sanitizeString)(input, 50);
    return sanitized.replace(/[^a-zA-Z0-9_-]/g, '');
};
exports.sanitizeUserId = sanitizeUserId;
const sanitizePlaybackAction = (input) => {
    return (0, exports.sanitizeObject)(input, {
        type: (value) => {
            const sanitized = (0, exports.sanitizeString)(value, 20);
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
exports.sanitizePlaybackAction = sanitizePlaybackAction;
const sanitizeRoomData = (input) => {
    return (0, exports.sanitizeObject)(input, {
        name: exports.sanitizeRoomName,
        mediaId: exports.sanitizeMediaId,
        mediaType: (value) => {
            const sanitized = (0, exports.sanitizeString)(value, 10);
            return ['movie', 'tv'].includes(sanitized) ? sanitized : null;
        },
        adminId: exports.sanitizeUserId
    });
};
exports.sanitizeRoomData = sanitizeRoomData;
const isSafeInput = (input) => {
    if (typeof input === 'string') {
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
        return Object.values(input).every(exports.isSafeInput);
    }
    return true;
};
exports.isSafeInput = isSafeInput;
//# sourceMappingURL=sanitizer.js.map
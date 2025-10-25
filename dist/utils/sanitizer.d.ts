export declare const sanitizeString: (input: any, maxLength?: number) => string;
export declare const sanitizeNumber: (input: any, min?: number, max?: number) => number;
export declare const sanitizeBoolean: (input: any) => boolean;
export declare const sanitizeId: (input: any) => string;
export declare const sanitizeUrl: (input: any) => string;
export declare const sanitizeEmail: (input: any) => string;
export declare const sanitizeSearchQuery: (input: any) => string;
export declare const sanitizeDate: (input: any) => Date | null;
export declare const sanitizeArray: (input: any, itemSanitizer?: (item: any) => any) => any[];
export declare const sanitizeObject: (input: any, schema: Record<string, (value: any) => any>) => any;
export declare const sanitizePagination: (input: any) => {
    page: number;
    limit: number;
};
export declare const sanitizeSort: (input: any, allowedFields: string[]) => {
    field: string;
    direction: "asc" | "desc";
};
export declare const sanitizeMediaId: (input: any) => string;
export declare const sanitizeRoomName: (input: any) => string;
export declare const sanitizeUserId: (input: any) => string;
export declare const sanitizePlaybackAction: (input: any) => any;
export declare const sanitizeRoomData: (input: any) => any;
export declare const isSafeInput: (input: any) => boolean;
//# sourceMappingURL=sanitizer.d.ts.map
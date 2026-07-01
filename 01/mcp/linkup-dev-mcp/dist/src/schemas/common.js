/**
 * Common schemas shared across all tools.
 */
import { z } from 'zod';
export const SERVER_VERSION = '0.1.0';
/**
 * Tool envelope schema - wraps all tool responses.
 */
export function createToolEnvelope(dataSchema) {
    return z.object({
        ok: z.boolean(),
        data: dataSchema.optional(),
        error: z.object({
            code: z.string(),
            message: z.string(),
        }).optional(),
        meta: z.object({
            serverVersion: z.string(),
            generatedAt: z.string(),
            truncated: z.boolean(),
        }),
    });
}
export function createSuccessResponse(data, truncated = false) {
    return {
        ok: true,
        data,
        meta: {
            serverVersion: SERVER_VERSION,
            generatedAt: new Date().toISOString(),
            truncated,
        },
    };
}
export function createErrorResponse(code, message) {
    return {
        ok: false,
        error: { code, message },
        meta: {
            serverVersion: SERVER_VERSION,
            generatedAt: new Date().toISOString(),
            truncated: false,
        },
    };
}
//# sourceMappingURL=common.js.map
/**
 * Common schemas shared across all tools.
 */

import { z } from 'zod';

export const SERVER_VERSION = '0.1.0';

/**
 * Tool envelope schema - wraps all tool responses.
 */
export function createToolEnvelope<T extends z.ZodType>(dataSchema: T) {
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

export interface ToolEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    serverVersion: string;
    generatedAt: string;
    truncated: boolean;
  };
}

export function createSuccessResponse<T>(data: T, truncated = false): ToolEnvelope<T> {
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

export function createErrorResponse(code: string, message: string): ToolEnvelope<never> {
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

/**
 * Schemas for runtime_console_logs tool.
 */

import { z } from 'zod';
import { createToolEnvelope } from './common.js';

export const RuntimeConsoleLogsInputSchema = z.object({
  level: z.enum(['log', 'warn', 'error', 'warning']).optional(),
  limit: z.number().int().min(1).max(500).optional().default(100),
  since: z.number().optional(),
});

const StackFrameSchema = z.object({
  functionName: z.string(),
  url: z.string(),
  lineNumber: z.number(),
});

const LogEntrySchema = z.object({
  level: z.string(),
  text: z.string(),
  timestamp: z.number(),
  stackTrace: z.array(StackFrameSchema).optional(),
});

export const RuntimeConsoleLogsDataSchema = z.object({
  logs: z.array(LogEntrySchema),
  total: z.number(),
  truncated: z.boolean(),
});

export const RuntimeConsoleLogsOutputSchema = createToolEnvelope(RuntimeConsoleLogsDataSchema);

export type RuntimeConsoleLogsInput = z.infer<typeof RuntimeConsoleLogsInputSchema>;
export type RuntimeConsoleLogsData = z.infer<typeof RuntimeConsoleLogsDataSchema>;

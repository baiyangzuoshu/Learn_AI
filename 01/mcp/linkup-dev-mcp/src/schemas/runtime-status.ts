/**
 * Schemas for runtime_status tool.
 */

import { z } from 'zod';
import { createToolEnvelope } from './common.js';

export const RuntimeStatusInputSchema = z.object({});

export const RuntimeStatusDataSchema = z.object({
  status: z.enum(['connected', 'disconnected']),
  scene: z.string().nullable().optional(),
  resolution: z.object({
    width: z.number(),
    height: z.number(),
  }).nullable().optional(),
  visibleSize: z.object({
    width: z.number(),
    height: z.number(),
  }).nullable().optional(),
  fps: z.number().nullable().optional(),
  pageUrl: z.string().nullable().optional(),
  connectedAt: z.string().nullable().optional(),
  lastSeenAt: z.string().nullable().optional(),
  error: z.string().optional(),
});

export const RuntimeStatusOutputSchema = createToolEnvelope(RuntimeStatusDataSchema);

export type RuntimeStatusInput = z.infer<typeof RuntimeStatusInputSchema>;
export type RuntimeStatusData = z.infer<typeof RuntimeStatusDataSchema>;

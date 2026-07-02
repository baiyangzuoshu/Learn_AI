/**
 * Schemas for runtime_capture_preview tool.
 */
import { z } from 'zod';
import { createToolEnvelope } from './common.js';
export const RuntimeCapturePreviewInputSchema = z.object({
    format: z.enum(['png', 'jpeg']).optional().default('png'),
    quality: z.number().int().min(1).max(100).optional(),
});
export const RuntimeCapturePreviewDataSchema = z.object({
    format: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
    base64: z.string(),
    sizeBytes: z.number(),
});
export const RuntimeCapturePreviewOutputSchema = createToolEnvelope(RuntimeCapturePreviewDataSchema);
//# sourceMappingURL=runtime-capture-preview.js.map
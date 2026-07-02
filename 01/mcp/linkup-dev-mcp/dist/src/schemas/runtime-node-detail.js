/**
 * Schemas for runtime_node_detail tool.
 */
import { z } from 'zod';
import { createToolEnvelope } from './common.js';
export const RuntimeNodeDetailInputSchema = z.object({
    nodePath: z.string().min(1).max(512),
});
const ComponentDetailSchema = z.object({
    name: z.string(),
    enabled: z.boolean(),
});
export const RuntimeNodeDetailDataSchema = z.object({
    name: z.string(),
    path: z.string(),
    active: z.boolean(),
    position: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
    size: z.object({ width: z.number(), height: z.number() }).nullable().optional(),
    opacity: z.number().nullable().optional(),
    anchorPoint: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
    components: z.array(ComponentDetailSchema),
    childrenCount: z.number(),
});
export const RuntimeNodeDetailOutputSchema = createToolEnvelope(RuntimeNodeDetailDataSchema);
//# sourceMappingURL=runtime-node-detail.js.map
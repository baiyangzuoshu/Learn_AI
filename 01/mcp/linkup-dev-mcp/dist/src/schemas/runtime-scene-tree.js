/**
 * Schemas for runtime_scene_tree tool.
 */
import { z } from 'zod';
import { createToolEnvelope } from './common.js';
export const RuntimeSceneTreeInputSchema = z.object({
    maxDepth: z.number().int().min(1).max(8).optional().default(8),
    maxNodes: z.number().int().min(1).max(2000).optional().default(2000),
});
const TreeNodeSchema = z.lazy(() => z.object({
    name: z.string(),
    active: z.boolean(),
    position: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
    size: z.object({ width: z.number(), height: z.number() }).nullable().optional(),
    opacity: z.number().nullable().optional(),
    components: z.array(z.string()),
    children: z.array(TreeNodeSchema).optional(),
    childrenTruncated: z.boolean().optional(),
}));
export const RuntimeSceneTreeDataSchema = z.object({
    tree: TreeNodeSchema.nullable(),
    totalNodes: z.number(),
    truncated: z.boolean(),
});
export const RuntimeSceneTreeOutputSchema = createToolEnvelope(RuntimeSceneTreeDataSchema);
//# sourceMappingURL=runtime-scene-tree.js.map
/**
 * Input/output schemas for inspect_ui_prefab tool.
 */

import { z } from 'zod';

export const InspectUiPrefabInputSchema = z.object({
  uiName: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,127}$/, 'uiName must match ^[A-Za-z][A-Za-z0-9_]{0,127}$').describe('UI name to inspect (alphanumeric + underscore, starting with letter).'),
  maxDepth: z.number().int().min(0).max(8).optional().describe('Maximum tree depth (0-8). Defaults to 8.'),
  includeInactive: z.boolean().optional().default(true).describe('Include inactive nodes. Defaults to true.'),
});

export type InspectUiPrefabInput = z.infer<typeof InspectUiPrefabInputSchema>;

export const PrefabNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    active: z.boolean().optional(),
    depth: z.number(),
    components: z.array(z.object({
      typeName: z.string(),
    })).optional(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    size: z.object({ width: z.number(), height: z.number() }).optional(),
    children: z.array(PrefabNodeSchema).optional(),
  })
);

export const InspectUiPrefabOutputSchema = z.object({
  uiName: z.string(),
  prefabRelPath: z.string(),
  rootNodeName: z.string(),
  controllerRelPath: z.string().optional(),
  registrationStatus: z.enum(['global', 'local', 'unregistered', 'ambiguous']),
  nodeTree: z.object({
    name: z.string(),
    path: z.string(),
    active: z.boolean().optional(),
    depth: z.number(),
    components: z.array(z.object({ typeName: z.string() })).optional(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    size: z.object({ width: z.number(), height: z.number() }).optional(),
    children: z.array(z.any()).optional(),
  }).optional(),
  nodeCount: z.number(),
  returnedNodeCount: z.number(),
  diagnostics: z.array(z.any()).optional(),
});

export type InspectUiPrefabOutput = z.infer<typeof InspectUiPrefabOutputSchema>;

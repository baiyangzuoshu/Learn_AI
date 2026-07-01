/**
 * Input/output schemas for resolve_ui_contract tool.
 */

import { z } from 'zod';

export const ResolveUiContractInputSchema = z.object({
  uiName: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,127}$/, 'uiName must match ^[A-Za-z][A-Za-z0-9_]{0,127}$').describe('UI name to resolve contract for.'),
});

export type ResolveUiContractInput = z.infer<typeof ResolveUiContractInputSchema>;

export const NodePathEntrySchema = z.object({
  path: z.string(),
  functionName: z.string(),
  line: z.number(),
  isDynamic: z.boolean(),
  kind: z.enum(['lookup', 'button', 'delay-button', 'mouse']),
  exists: z.boolean().nullable(),
});

export const ResolveUiContractOutputSchema = z.object({
  uiName: z.string(),
  prefabBasename: z.string(),
  prefabRelPath: z.string(),
  rootNodeName: z.string(),
  uiNameKey: z.string().optional(),
  uiNameValue: z.string().optional(),
  uiNameLine: z.number().optional(),
  uiControllerNameKey: z.string().optional(),
  uiControllerNameValue: z.string().optional(),
  controllerRelPath: z.string().optional(),
  controllerClassName: z.string().optional(),
  uiControllerHandler: z.string().optional(),
  uiControllerLine: z.number().optional(),
  nodePaths: z.array(NodePathEntrySchema),
  status: z.enum(['complete', 'incomplete', 'ambiguous', 'not_found']),
  diagnostics: z.array(z.any()).optional(),
});

export type ResolveUiContractOutput = z.infer<typeof ResolveUiContractOutputSchema>;

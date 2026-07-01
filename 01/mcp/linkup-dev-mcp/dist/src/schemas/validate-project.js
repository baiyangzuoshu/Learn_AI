/**
 * Input/output schemas for validate_project tool.
 */
import { z } from 'zod';
export const ValidateProjectInputSchema = z.object({
    rules: z.array(z.string()).optional().describe('Rule IDs to run (from listRules). Runs all if omitted.'),
    includeBaselined: z.boolean().optional().default(true).describe('Include baselined diagnostics in results.'),
    maxDiagnostics: z.number().int().min(1).max(500).optional().describe('Maximum diagnostics to return (1-500).'),
});
export const DiagnosticSchema = z.object({
    ruleId: z.string(),
    severity: z.string(),
    file: z.string().optional(),
    line: z.number().optional(),
    subject: z.string(),
    message: z.string(),
    suggestion: z.string().optional(),
    fingerprint: z.string().optional(),
    baselined: z.boolean().optional(),
});
export const ValidateProjectOutputSchema = z.object({
    diagnostics: z.array(DiagnosticSchema),
    summary: z.object({
        errors: z.number(),
        warnings: z.number(),
        infos: z.number(),
        baselined: z.number().optional(),
        returnedDiagnostics: z.number(),
        totalDiagnostics: z.number(),
        passedRules: z.number().optional(),
    }),
    executedRules: z.array(z.string()),
});
//# sourceMappingURL=validate-project.js.map
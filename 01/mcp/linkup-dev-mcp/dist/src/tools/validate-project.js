/**
 * validate_project tool handler.
 *
 * Runs G1 static checks and returns structured diagnostics.
 */
import { ErrorCode } from '../errors.js';
import { createSuccessResponse, createErrorResponse } from '../schemas/common.js';
import { createLogger } from '../logger.js';
import { listRules } from 'linkup-check';
const logger = createLogger('validate_project');
export async function handleValidateProject(ctx, input) {
    const start = Date.now();
    try {
        // Validate rule IDs if provided
        const availableRules = listRules();
        if (input.rules) {
            for (const rule of input.rules) {
                if (!availableRules.includes(rule)) {
                    return createErrorResponse(ErrorCode.LIMIT_EXCEEDED, `Unknown rule "${rule}". Available: ${availableRules.join(', ')}`);
                }
            }
        }
        // Run checks
        const result = await ctx.runChecks({
            ruleIds: input.rules,
        });
        // Process diagnostics
        let diagnostics = result.diagnostics;
        // Filter baselined if requested
        const includeBaselined = input.includeBaselined ?? true;
        if (!includeBaselined) {
            diagnostics = diagnostics.filter((d) => !d.baselined);
        }
        const totalDiagnostics = diagnostics.length;
        // Apply maxDiagnostics limit
        const maxDiagnostics = input.maxDiagnostics ?? 500;
        const truncated = diagnostics.length > maxDiagnostics;
        if (truncated) {
            diagnostics = diagnostics.slice(0, maxDiagnostics);
        }
        const elapsed = Date.now() - start;
        logger.info(`validate_project completed in ${elapsed}ms: ${result.summary.total} diagnostics`);
        return createSuccessResponse({
            diagnostics,
            summary: {
                ...result.summary,
                returnedDiagnostics: diagnostics.length,
                totalDiagnostics,
            },
            executedRules: input.rules ?? availableRules,
        }, truncated);
    }
    catch (e) {
        logger.error('validate_project failed');
        const code = e?.code ?? ErrorCode.CHECK_FAILED;
        const message = e?.message ?? String(e);
        return createErrorResponse(code, message);
    }
}
//# sourceMappingURL=validate-project.js.map
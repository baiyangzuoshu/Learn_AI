/**
 * validate_project tool handler.
 *
 * Runs G1 static checks and returns structured diagnostics.
 */
import type { ProjectContext } from '../project-context.js';
import type { ValidateProjectInput } from '../schemas/validate-project.js';
import { type ToolEnvelope } from '../schemas/common.js';
export declare function handleValidateProject(ctx: ProjectContext, input: ValidateProjectInput): Promise<ToolEnvelope<any>>;
//# sourceMappingURL=validate-project.d.ts.map
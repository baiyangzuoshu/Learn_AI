/**
 * Resource: linkup://validation/rules
 * Returns available validation rules as JSON.
 */
import type { ProjectContext } from '../project-context.js';
export declare const VALIDATION_RULES_URI = "linkup://validation/rules";
export declare function readValidationRules(ctx: ProjectContext): {
    mimeType: string;
    text: string;
};
//# sourceMappingURL=validation-rules.d.ts.map
/**
 * Resource: linkup://validation/rules
 * Returns available validation rules as JSON.
 */
import { listRules } from 'linkup-check';
import { relative } from 'node:path';
export const VALIDATION_RULES_URI = 'linkup://validation/rules';
export function readValidationRules(ctx) {
    const ruleIds = listRules();
    const ruleDescriptions = {
        'prefab/json-valid': {
            description: 'Validates that prefab files contain valid JSON arrays with cc.Prefab type.',
            severity: 'ERROR',
        },
        'ui/prefab-root-name': {
            description: 'Checks that prefab root node names match file names and are unique.',
            severity: 'WARNING',
        },
        'ui/controller-node-paths': {
            description: 'Verifies that node paths in controllers exist in the corresponding prefab hierarchy.',
            severity: 'INFO',
        },
        'ui/registration': {
            description: 'Checks UIName/UIControllerName registration consistency between Constant.ts, UIController.ts, and prefab files.',
            severity: 'INFO',
        },
        'component/duplicate-attach': {
            description: 'Detects duplicate addComponent calls for the same component type in a controller method.',
            severity: 'WARNING',
        },
    };
    const rules = ruleIds.map(id => ({
        id,
        description: ruleDescriptions[id]?.description ?? 'No description available.',
        severity: ruleDescriptions[id]?.severity ?? 'INFO',
    }));
    const baselineRelPath = relative(ctx.projectRoot, ctx.baselinePath);
    const result = {
        rules,
        baseline: {
            path: baselineRelPath,
            note: 'Baseline entries are applied automatically. Baselined diagnostics are included in results by default.',
        },
    };
    return { mimeType: 'application/json', text: JSON.stringify(result, null, 2) };
}
//# sourceMappingURL=validation-rules.js.map
/**
 * resolve_ui_contract tool handler.
 *
 * Resolves the full UI contract: prefab, constants, controller, node paths, and registration.
 */
import type { ProjectContext } from '../project-context.js';
import type { ResolveUiContractInput } from '../schemas/resolve-ui-contract.js';
import { type ToolEnvelope } from '../schemas/common.js';
export declare function handleResolveUiContract(ctx: ProjectContext, input: ResolveUiContractInput): Promise<ToolEnvelope<any>>;
//# sourceMappingURL=resolve-ui-contract.d.ts.map
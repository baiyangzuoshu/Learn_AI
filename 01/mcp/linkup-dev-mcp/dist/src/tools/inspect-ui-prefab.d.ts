/**
 * inspect_ui_prefab tool handler.
 *
 * Returns a depth-limited node tree with component summary for a named UI.
 */
import type { ProjectContext } from '../project-context.js';
import type { InspectUiPrefabInput } from '../schemas/inspect-ui-prefab.js';
import { type ToolEnvelope } from '../schemas/common.js';
export declare function handleInspectUiPrefab(ctx: ProjectContext, input: InspectUiPrefabInput): Promise<ToolEnvelope<any>>;
//# sourceMappingURL=inspect-ui-prefab.d.ts.map
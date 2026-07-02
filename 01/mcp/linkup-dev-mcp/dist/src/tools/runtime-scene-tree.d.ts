/**
 * runtime_scene_tree tool handler.
 *
 * Attempts lazy connection, then returns a depth-limited node tree.
 */
import type { CDPManager } from '../runtime/cdp-manager.js';
import type { RuntimeSceneTreeInput } from '../schemas/runtime-scene-tree.js';
import { type ToolEnvelope } from '../schemas/common.js';
export declare function handleRuntimeSceneTree(cdpManager: CDPManager, input: RuntimeSceneTreeInput): Promise<ToolEnvelope<any>>;
//# sourceMappingURL=runtime-scene-tree.d.ts.map
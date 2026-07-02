/**
 * runtime_node_detail tool handler.
 *
 * Attempts lazy connection, then returns node detail by path.
 */
import type { CDPManager } from '../runtime/cdp-manager.js';
import type { RuntimeNodeDetailInput } from '../schemas/runtime-node-detail.js';
import { type ToolEnvelope } from '../schemas/common.js';
export declare function handleRuntimeNodeDetail(cdpManager: CDPManager, input: RuntimeNodeDetailInput): Promise<ToolEnvelope<any>>;
//# sourceMappingURL=runtime-node-detail.d.ts.map
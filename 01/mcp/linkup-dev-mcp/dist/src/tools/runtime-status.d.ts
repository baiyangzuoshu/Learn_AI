/**
 * runtime_status tool handler.
 *
 * Always attempts to connect if not already connected (lazy connect).
 * Returns disconnected within 2s if no preview is running (G4-01).
 * Returns connected with scene/resolution info if preview is available (G4-02).
 */
import type { CDPManager } from '../runtime/cdp-manager.js';
import type { RuntimeStatusInput } from '../schemas/runtime-status.js';
import { type ToolEnvelope } from '../schemas/common.js';
export declare function handleRuntimeStatus(cdpManager: CDPManager, _input: RuntimeStatusInput): Promise<ToolEnvelope<any>>;
//# sourceMappingURL=runtime-status.d.ts.map
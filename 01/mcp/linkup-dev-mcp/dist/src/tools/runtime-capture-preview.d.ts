/**
 * runtime_capture_preview tool handler.
 *
 * Attempts lazy connection, then captures a screenshot via CDP.
 */
import type { CDPManager } from '../runtime/cdp-manager.js';
import type { RuntimeCapturePreviewInput } from '../schemas/runtime-capture-preview.js';
import { type ToolEnvelope } from '../schemas/common.js';
export declare function handleRuntimeCapturePreview(cdpManager: CDPManager, input: RuntimeCapturePreviewInput): Promise<ToolEnvelope<any>>;
//# sourceMappingURL=runtime-capture-preview.d.ts.map
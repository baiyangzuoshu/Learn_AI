/**
 * runtime_console_logs tool handler.
 *
 * Attempts lazy connection, then returns buffered console logs.
 */
import type { CDPManager } from '../runtime/cdp-manager.js';
import type { RuntimeConsoleLogsInput } from '../schemas/runtime-console-logs.js';
import { type ToolEnvelope } from '../schemas/common.js';
export declare function handleRuntimeConsoleLogs(cdpManager: CDPManager, input: RuntimeConsoleLogsInput): Promise<ToolEnvelope<any>>;
//# sourceMappingURL=runtime-console-logs.d.ts.map
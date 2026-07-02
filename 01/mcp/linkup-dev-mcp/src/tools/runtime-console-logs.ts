/**
 * runtime_console_logs tool handler.
 *
 * Attempts lazy connection, then returns buffered console logs.
 */

import type { CDPManager } from '../runtime/cdp-manager.js';
import type { RuntimeConsoleLogsInput } from '../schemas/runtime-console-logs.js';
import { ErrorCode } from '../errors.js';
import { createSuccessResponse, createErrorResponse, type ToolEnvelope } from '../schemas/common.js';
import { createLogger } from '../logger.js';

const logger = createLogger('runtime_console_logs');

export async function handleRuntimeConsoleLogs(
  cdpManager: CDPManager,
  input: RuntimeConsoleLogsInput
): Promise<ToolEnvelope<any>> {
  // Ensure connected (lazy connect attempt)
  const status = await cdpManager.ensureConnected();
  if (!status.connected) {
    return createErrorResponse(
      ErrorCode.RUNTIME_UNAVAILABLE,
      `Runtime not connected: ${status.error || 'Start Cocos Creator browser preview first.'}`
    );
  }

  const start = Date.now();
  try {
    const allLogs = cdpManager.getConsoleLogs({
      level: input.level,
      since: input.since,
    });

    const limit = input.limit ?? 100;
    const truncated = allLogs.length > limit;
    const logs = truncated ? allLogs.slice(-limit) : allLogs;

    const elapsed = Date.now() - start;
    logger.info(`runtime_console_logs completed in ${elapsed}ms: ${logs.length} entries`);

    return createSuccessResponse({
      logs,
      total: allLogs.length,
      truncated,
    });

  } catch (err: any) {
    logger.error(`runtime_console_logs failed: ${err.message}`);
    return createErrorResponse(ErrorCode.RUNTIME_PROTOCOL_ERROR, `Failed to read console logs: ${err.message}`);
  }
}

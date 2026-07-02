/**
 * runtime_node_detail tool handler.
 *
 * Attempts lazy connection, then returns node detail by path.
 */
import { ErrorCode } from '../errors.js';
import { createSuccessResponse, createErrorResponse } from '../schemas/common.js';
import { createLogger } from '../logger.js';
import { buildNodeDetailExpression } from '../runtime/whitelist.js';
const logger = createLogger('runtime_node_detail');
export async function handleRuntimeNodeDetail(cdpManager, input) {
    // Ensure connected (lazy connect attempt)
    const status = await cdpManager.ensureConnected();
    if (!status.connected) {
        return createErrorResponse(ErrorCode.RUNTIME_UNAVAILABLE, `Runtime not connected: ${status.error || 'Start Cocos Creator browser preview first.'}`);
    }
    const start = Date.now();
    try {
        // Validate nodePath through whitelist
        const expression = buildNodeDetailExpression(input.nodePath);
        const result = await cdpManager.evaluateSafe(expression);
        if (!result || result.error) {
            return createErrorResponse(ErrorCode.UI_NOT_FOUND, result?.error || `Node not found: ${input.nodePath}`);
        }
        const elapsed = Date.now() - start;
        logger.info(`runtime_node_detail completed in ${elapsed}ms: ${result.name}`);
        return createSuccessResponse(result);
    }
    catch (err) {
        logger.error(`runtime_node_detail failed: ${err.message}`);
        if (err.message?.includes('Invalid node path') || err.message?.includes('too long')) {
            return createErrorResponse(ErrorCode.LIMIT_EXCEEDED, err.message);
        }
        if (err.message?.includes('timed out')) {
            return createErrorResponse(ErrorCode.RUNTIME_TIMEOUT, `Node detail query timed out: ${err.message}`);
        }
        return createErrorResponse(ErrorCode.RUNTIME_PROTOCOL_ERROR, `Failed to read node detail: ${err.message}`);
    }
}
//# sourceMappingURL=runtime-node-detail.js.map
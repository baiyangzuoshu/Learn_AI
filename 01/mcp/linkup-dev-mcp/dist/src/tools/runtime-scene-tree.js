/**
 * runtime_scene_tree tool handler.
 *
 * Attempts lazy connection, then returns a depth-limited node tree.
 */
import { ErrorCode } from '../errors.js';
import { createSuccessResponse, createErrorResponse } from '../schemas/common.js';
import { createLogger } from '../logger.js';
import { buildSceneTreeExpression } from '../runtime/whitelist.js';
const logger = createLogger('runtime_scene_tree');
export async function handleRuntimeSceneTree(cdpManager, input) {
    // Ensure connected (lazy connect attempt)
    const status = await cdpManager.ensureConnected();
    if (!status.connected) {
        return createErrorResponse(ErrorCode.RUNTIME_UNAVAILABLE, `Runtime not connected: ${status.error || 'Start Cocos Creator browser preview first.'}`);
    }
    const start = Date.now();
    try {
        const expression = buildSceneTreeExpression(input.maxDepth ?? 8, input.maxNodes ?? 2000);
        const result = await cdpManager.evaluateSafe(expression);
        if (!result || result.error) {
            return createErrorResponse(ErrorCode.RUNTIME_PROTOCOL_ERROR, result?.error || 'Failed to read scene tree from preview');
        }
        const elapsed = Date.now() - start;
        logger.info(`runtime_scene_tree completed in ${elapsed}ms: ${result.totalNodes} nodes`);
        return createSuccessResponse({
            tree: result.tree,
            totalNodes: result.totalNodes || 0,
            truncated: result.truncated || false,
        });
    }
    catch (err) {
        logger.error(`runtime_scene_tree failed: ${err.message}`);
        if (err.message?.includes('timed out')) {
            return createErrorResponse(ErrorCode.RUNTIME_TIMEOUT, `Scene tree query timed out: ${err.message}`);
        }
        return createErrorResponse(ErrorCode.RUNTIME_PROTOCOL_ERROR, `Failed to read scene tree: ${err.message}`);
    }
}
//# sourceMappingURL=runtime-scene-tree.js.map
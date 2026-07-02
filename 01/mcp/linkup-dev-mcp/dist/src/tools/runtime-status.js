/**
 * runtime_status tool handler.
 *
 * Always attempts to connect if not already connected (lazy connect).
 * Returns disconnected within 2s if no preview is running (G4-01).
 * Returns connected with scene/resolution info if preview is available (G4-02).
 */
import { ErrorCode } from '../errors.js';
import { createSuccessResponse, createErrorResponse } from '../schemas/common.js';
import { createLogger } from '../logger.js';
import { buildStatusExpression } from '../runtime/whitelist.js';
const logger = createLogger('runtime_status');
export async function handleRuntimeStatus(cdpManager, _input) {
    const start = Date.now();
    try {
        // Lazy connect: attempt connection if not already connected.
        // Use a fast timeout (1500ms) to ensure we stay within the 2s G4-01 requirement.
        const status = await cdpManager.ensureConnected(1500);
        if (!status.connected) {
            // Connection attempt failed or no preview running. Return disconnected quickly.
            const elapsed = Date.now() - start;
            logger.info(`runtime_status (disconnected) in ${elapsed}ms`);
            return createSuccessResponse({
                status: 'disconnected',
                scene: null,
                resolution: null,
                error: status.error || 'Cocos Creator preview is not connected. Start Cocos Creator browser preview with Chrome --remote-debugging-port.',
            });
        }
        // Connected. Get fresh status from the preview.
        try {
            const info = await cdpManager.evaluateSafe(buildStatusExpression());
            const elapsed = Date.now() - start;
            logger.info(`runtime_status (connected) in ${elapsed}ms`);
            return createSuccessResponse({
                status: 'connected',
                scene: info?.scene || null,
                resolution: info?.resolution || null,
                visibleSize: info?.visibleSize || null,
                fps: info?.fps || null,
                pageUrl: info?.pageUrl || null,
                connectedAt: cdpManager.getStatus().connectedAt || null,
                lastSeenAt: cdpManager.getStatus().lastSeenAt || null,
            });
        }
        catch (evalErr) {
            // Connected but eval failed — may have disconnected during operation
            const elapsed = Date.now() - start;
            logger.warn(`runtime_status eval failed in ${elapsed}ms: ${evalErr.message}`);
            return createErrorResponse(ErrorCode.RUNTIME_PROTOCOL_ERROR, `Connected but failed to read status: ${evalErr.message}`);
        }
    }
    catch (err) {
        logger.error(`runtime_status failed: ${err.message}`);
        return createErrorResponse(ErrorCode.INTERNAL_ERROR, `runtime_status failed: ${err.message}`);
    }
}
//# sourceMappingURL=runtime-status.js.map
/**
 * runtime_capture_preview tool handler.
 *
 * Attempts lazy connection, then captures a screenshot via CDP.
 */
import { ErrorCode } from '../errors.js';
import { createSuccessResponse, createErrorResponse } from '../schemas/common.js';
import { createLogger } from '../logger.js';
const logger = createLogger('runtime_capture_preview');
export async function handleRuntimeCapturePreview(cdpManager, input) {
    // Ensure connected (lazy connect attempt)
    const status = await cdpManager.ensureConnected();
    if (!status.connected) {
        return createErrorResponse(ErrorCode.RUNTIME_UNAVAILABLE, `Runtime not connected: ${status.error || 'Start Cocos Creator browser preview first.'}`);
    }
    const start = Date.now();
    try {
        const format = input.format ?? 'png';
        const base64 = await cdpManager.captureScreenshot(format, input.quality);
        // Calculate approximate size
        const sizeBytes = Math.ceil(base64.length * 3 / 4);
        const elapsed = Date.now() - start;
        logger.info(`runtime_capture_preview completed in ${elapsed}ms: ${format} ${sizeBytes} bytes`);
        // Get canvas dimensions from runtime if available
        let width;
        let height;
        try {
            const sizeInfo = await cdpManager.evaluateSafe(`
        (function() {
          var canvas = document.querySelector('canvas');
          return canvas ? { width: canvas.width, height: canvas.height } : null;
        })()
      `);
            if (sizeInfo) {
                width = sizeInfo.width;
                height = sizeInfo.height;
            }
        }
        catch { /* non-critical */ }
        return createSuccessResponse({
            format,
            width,
            height,
            base64,
            sizeBytes,
        });
    }
    catch (err) {
        logger.error(`runtime_capture_preview failed: ${err.message}`);
        if (err.message?.includes('timed out')) {
            return createErrorResponse(ErrorCode.RUNTIME_TIMEOUT, `Screenshot timed out: ${err.message}`);
        }
        return createErrorResponse(ErrorCode.RUNTIME_PROTOCOL_ERROR, `Failed to capture screenshot: ${err.message}`);
    }
}
//# sourceMappingURL=runtime-capture-preview.js.map
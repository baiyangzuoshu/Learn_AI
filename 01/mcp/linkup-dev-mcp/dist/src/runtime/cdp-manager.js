/**
 * CDP Connection Manager for Runtime observation.
 *
 * Manages Chrome DevTools Protocol connection to Cocos Creator browser preview.
 * Provides safe, read-only access to the running game via whitelisted JS expressions.
 */
import CDP from 'chrome-remote-interface';
import { createLogger } from '../logger.js';
const logger = createLogger('cdp-manager');
export class CDPManager {
    config;
    client = null;
    target = null;
    connectedAt = null;
    lastSeenAt = null;
    consoleBuffer = [];
    consoleHandler = null;
    _status = { connected: false };
    constructor(config) {
        this.config = config;
    }
    /** Current connection status */
    getStatus() {
        return { ...this._status };
    }
    /**
     * Try to connect to Chrome DevTools and find a Cocos preview page.
     * Returns connection status without throwing.
     */
    async connect() {
        // If already connected, verify the connection
        if (this.client && this.target) {
            try {
                await this.ping();
                this.lastSeenAt = new Date().toISOString();
                return this.getStatus();
            }
            catch {
                // Connection lost, reconnect
                await this.disconnect();
            }
        }
        try {
            // List available targets
            const targets = await CDP.List({ host: this.config.host, port: this.config.port });
            // Find a Cocos preview page (look for cc.game or canvas)
            const cocosTarget = targets.find((t) => t.type === 'page' && (t.url.includes('cocos') ||
                t.url.includes('preview') ||
                t.url.includes('localhost') ||
                t.url.includes('127.0.0.1')));
            if (!cocosTarget) {
                // Fallback: use first page target
                const pageTarget = targets.find((t) => t.type === 'page');
                if (!pageTarget) {
                    this._status = {
                        connected: false,
                        error: 'No browser page target found. Is Chrome running with --remote-debugging-port?',
                    };
                    return this.getStatus();
                }
                this.target = pageTarget;
            }
            else {
                this.target = cocosTarget;
            }
            // Connect to the target
            this.client = await CDP({
                host: this.config.host,
                port: this.config.port,
                target: this.target,
            });
            // Enable required domains
            await this.client.Runtime.enable();
            await this.client.Page.enable();
            // Set up console log capture
            this.setupConsoleCapture();
            // Verify this is a Cocos preview by checking for cc object
            const ccCheck = await this.evaluateSafe('typeof cc !== "undefined" && cc.director ? true : false');
            if (ccCheck !== true) {
                await this.disconnect();
                this._status = {
                    connected: false,
                    error: 'Connected to browser but page is not a Cocos Creator preview (cc.director not found).',
                };
                return this.getStatus();
            }
            // Get initial scene info
            const sceneInfo = await this.evaluateSafe(`
        (function() {
          var scene = cc.director.getScene();
          var canvas = cc.Canvas.instance;
          var res = canvas ? canvas.designResolution : null;
          return {
            scene: scene ? scene.name : null,
            resolution: res ? { width: res.width, height: res.height } : null,
            pageUrl: window.location.href
          };
        })()
      `);
            this.connectedAt = new Date().toISOString();
            this.lastSeenAt = this.connectedAt;
            this._status = {
                connected: true,
                scene: sceneInfo?.scene || null,
                resolution: sceneInfo?.resolution || null,
                pageUrl: sceneInfo?.pageUrl || null,
                connectedAt: this.connectedAt,
                lastSeenAt: this.lastSeenAt,
            };
            logger.info(`Connected to Cocos preview: ${this.target.url}`);
            return this.getStatus();
        }
        catch (err) {
            this._status = {
                connected: false,
                error: `Connection failed: ${err.message || String(err)}`,
            };
            logger.error(`CDP connection failed: ${err.message || String(err)}`);
            return this.getStatus();
        }
    }
    /** Disconnect from Chrome DevTools */
    async disconnect() {
        if (this.consoleHandler && this.client) {
            try {
                this.client.off('Runtime.consoleAPICalled', this.consoleHandler);
            }
            catch { /* ignore */ }
        }
        this.consoleHandler = null;
        if (this.client) {
            try {
                await this.client.close();
            }
            catch { /* ignore */ }
        }
        this.client = null;
        this.target = null;
        this.connectedAt = null;
        this.lastSeenAt = null;
        this.consoleBuffer = [];
        this._status = { connected: false };
        logger.info('Disconnected from CDP');
    }
    /** Check if currently connected */
    isConnected() {
        return this._status.connected && this.client !== null;
    }
    /**
     * Ensure a CDP connection exists. If not connected, attempt to connect.
     * Returns the connection status. Never throws.
     *
     * @param timeoutMs Optional override for connection timeout (e.g. fast-path for runtime_status)
     */
    async ensureConnected(timeoutMs) {
        if (this.isConnected()) {
            // Verify existing connection is still alive
            try {
                await this.ping();
                this.lastSeenAt = new Date().toISOString();
                return this.getStatus();
            }
            catch {
                // Connection dropped, try to reconnect
                await this.disconnect();
            }
        }
        // Attempt a fresh connection with optional timeout override
        const originalTimeout = this.config.timeoutMs;
        if (timeoutMs !== undefined) {
            this.config.timeoutMs = timeoutMs;
        }
        try {
            const status = await this.connect();
            return status;
        }
        finally {
            this.config.timeoutMs = originalTimeout;
        }
    }
    /**
     * Evaluate a safe, whitelisted JavaScript expression.
     * The expression must be pre-validated by the whitelist module.
     */
    async evaluateSafe(expression) {
        if (!this.client) {
            throw new Error('Not connected to Chrome DevTools');
        }
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('CDP evaluation timed out')), this.config.timeoutMs));
        const evalPromise = this.client.Runtime.evaluate({
            expression,
            returnByValue: true,
            awaitPromise: false,
            timeout: this.config.timeoutMs,
        });
        const result = await Promise.race([evalPromise, timeoutPromise]);
        if (result.exceptionDetails) {
            const errMsg = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Unknown evaluation error';
            throw new Error(`Evaluation error: ${errMsg}`);
        }
        this.lastSeenAt = new Date().toISOString();
        return result.result?.value;
    }
    /** Capture a screenshot of the current page */
    async captureScreenshot(format = 'png', quality) {
        if (!this.client) {
            throw new Error('Not connected to Chrome DevTools');
        }
        const params = { format };
        if (quality !== undefined && format === 'jpeg') {
            params.quality = quality;
        }
        const result = await this.client.Page.captureScreenshot(params);
        this.lastSeenAt = new Date().toISOString();
        return result.data; // base64 encoded
    }
    /** Get buffered console logs */
    getConsoleLogs(options) {
        let logs = this.consoleBuffer;
        if (options?.level) {
            logs = logs.filter(l => l.level === options.level);
        }
        if (options?.since) {
            logs = logs.filter(l => l.timestamp >= options.since);
        }
        if (options?.limit && options.limit > 0) {
            logs = logs.slice(-options.limit);
        }
        return logs;
    }
    /** Set up console log capture via CDP */
    setupConsoleCapture() {
        if (!this.client)
            return;
        this.consoleHandler = (params) => {
            const entry = {
                level: params.type || 'log',
                text: params.args?.map((a) => a.value ?? a.description ?? '').join(' ') || '',
                timestamp: params.timestamp || Date.now(),
                stackTrace: params.stackTrace?.callFrames?.map((f) => ({
                    functionName: f.functionName || '',
                    url: f.url || '',
                    lineNumber: f.lineNumber || 0,
                })),
            };
            this.consoleBuffer.push(entry);
            // Trim buffer if too large
            if (this.consoleBuffer.length > this.config.maxConsoleLogs) {
                this.consoleBuffer = this.consoleBuffer.slice(-this.config.maxConsoleLogs);
            }
        };
        this.client.on('Runtime.consoleAPICalled', this.consoleHandler);
    }
    /** Ping to verify connection is alive */
    async ping() {
        if (!this.client)
            throw new Error('Not connected');
        await this.client.Runtime.evaluate({
            expression: '1',
            returnByValue: true,
        });
    }
}
/**
 * Create a CDPManager with default config.
 */
export function createCDPManager(overrides) {
    return new CDPManager({
        host: '127.0.0.1',
        port: 9222,
        timeoutMs: 5000,
        maxConsoleLogs: 1000,
        ...overrides,
    });
}
//# sourceMappingURL=cdp-manager.js.map
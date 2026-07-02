/**
 * CDP Connection Manager for Runtime observation.
 *
 * Manages Chrome DevTools Protocol connection to Cocos Creator browser preview.
 * Provides safe, read-only access to the running game via whitelisted JS expressions.
 */
export interface CDPManagerConfig {
    /** Chrome debugging host, default 127.0.0.1 */
    host: string;
    /** Chrome debugging port, default 9222 */
    port: number;
    /** Timeout for CDP operations in ms, default 5000 */
    timeoutMs: number;
    /** Max console log entries to buffer */
    maxConsoleLogs: number;
}
export interface RuntimeStatus {
    connected: boolean;
    scene?: string;
    resolution?: {
        width: number;
        height: number;
    };
    pageUrl?: string;
    connectedAt?: string;
    lastSeenAt?: string;
    error?: string;
}
interface ConsoleEntry {
    level: string;
    text: string;
    timestamp: number;
    stackTrace?: Array<{
        functionName: string;
        url: string;
        lineNumber: number;
    }>;
}
export declare class CDPManager {
    private config;
    private client;
    private target;
    private connectedAt;
    private lastSeenAt;
    private consoleBuffer;
    private consoleHandler;
    private _status;
    constructor(config: CDPManagerConfig);
    /** Current connection status */
    getStatus(): RuntimeStatus;
    /**
     * Try to connect to Chrome DevTools and find a Cocos preview page.
     * Returns connection status without throwing.
     */
    connect(): Promise<RuntimeStatus>;
    /** Disconnect from Chrome DevTools */
    disconnect(): Promise<void>;
    /** Check if currently connected */
    isConnected(): boolean;
    /**
     * Ensure a CDP connection exists. If not connected, attempt to connect.
     * Returns the connection status. Never throws.
     *
     * @param timeoutMs Optional override for connection timeout (e.g. fast-path for runtime_status)
     */
    ensureConnected(timeoutMs?: number): Promise<RuntimeStatus>;
    /**
     * Evaluate a safe, whitelisted JavaScript expression.
     * The expression must be pre-validated by the whitelist module.
     */
    evaluateSafe(expression: string): Promise<any>;
    /** Capture a screenshot of the current page */
    captureScreenshot(format?: string, quality?: number): Promise<string>;
    /** Get buffered console logs */
    getConsoleLogs(options?: {
        level?: string;
        limit?: number;
        since?: number;
    }): ConsoleEntry[];
    /** Set up console log capture via CDP */
    private setupConsoleCapture;
    /** Ping to verify connection is alive */
    private ping;
}
/**
 * Create a CDPManager with default config.
 */
export declare function createCDPManager(overrides?: Partial<CDPManagerConfig>): CDPManager;
export {};
//# sourceMappingURL=cdp-manager.d.ts.map
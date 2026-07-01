/**
 * Logger that writes only to stderr to keep stdout pure for MCP JSON-RPC.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export declare function setLogLevel(level: LogLevel): void;
export declare function createLogger(component: string): {
    debug(msg: string): void;
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
};
//# sourceMappingURL=logger.d.ts.map
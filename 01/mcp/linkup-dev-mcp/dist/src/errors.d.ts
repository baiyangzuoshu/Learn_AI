/**
 * Structured error codes for MCP tool responses.
 */
export declare const ErrorCode: {
    readonly CONFIG_INVALID: "CONFIG_INVALID";
    readonly PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND";
    readonly PROJECT_INDEX_FAILED: "PROJECT_INDEX_FAILED";
    readonly CHECK_FAILED: "CHECK_FAILED";
    readonly UI_NOT_FOUND: "UI_NOT_FOUND";
    readonly UI_AMBIGUOUS: "UI_AMBIGUOUS";
    readonly LIMIT_EXCEEDED: "LIMIT_EXCEEDED";
    readonly PATH_BOUNDARY_VIOLATION: "PATH_BOUNDARY_VIOLATION";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly RUNTIME_UNAVAILABLE: "RUNTIME_UNAVAILABLE";
    readonly RUNTIME_TIMEOUT: "RUNTIME_TIMEOUT";
    readonly RUNTIME_CONNECT_FAILED: "RUNTIME_CONNECT_FAILED";
    readonly RUNTIME_TARGET_NOT_FOUND: "RUNTIME_TARGET_NOT_FOUND";
    readonly RUNTIME_PROTOCOL_ERROR: "RUNTIME_PROTOCOL_ERROR";
    readonly RUNTIME_LIMIT_EXCEEDED: "RUNTIME_LIMIT_EXCEEDED";
};
export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];
export interface StructuredError {
    code: ErrorCodeType;
    message: string;
}
export declare function createError(code: ErrorCodeType, message: string): StructuredError;
/**
 * Map an unknown error to a StructuredError.
 * Stack traces are not included in the response; they should be logged to stderr.
 */
export declare function mapError(err: unknown, defaultCode?: ErrorCodeType): StructuredError;
//# sourceMappingURL=errors.d.ts.map
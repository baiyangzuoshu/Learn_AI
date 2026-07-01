/**
 * Structured error codes for MCP tool responses.
 */

export const ErrorCode = {
  CONFIG_INVALID: 'CONFIG_INVALID',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_INDEX_FAILED: 'PROJECT_INDEX_FAILED',
  CHECK_FAILED: 'CHECK_FAILED',
  UI_NOT_FOUND: 'UI_NOT_FOUND',
  UI_AMBIGUOUS: 'UI_AMBIGUOUS',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  PATH_BOUNDARY_VIOLATION: 'PATH_BOUNDARY_VIOLATION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface StructuredError {
  code: ErrorCodeType;
  message: string;
}

export function createError(code: ErrorCodeType, message: string): StructuredError {
  return { code, message };
}

/**
 * Map an unknown error to a StructuredError.
 * Stack traces are not included in the response; they should be logged to stderr.
 */
export function mapError(err: unknown, defaultCode: ErrorCodeType = ErrorCode.INTERNAL_ERROR): StructuredError {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    return err as StructuredError;
  }
  const message = err instanceof Error ? err.message : String(err);
  return createError(defaultCode, message);
}

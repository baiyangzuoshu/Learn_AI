/**
 * Schemas for runtime_console_logs tool.
 */
import { z } from 'zod';
export declare const RuntimeConsoleLogsInputSchema: z.ZodObject<{
    level: z.ZodOptional<z.ZodEnum<["log", "warn", "error", "warning"]>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    since: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    level?: "warn" | "error" | "log" | "warning" | undefined;
    since?: number | undefined;
}, {
    level?: "warn" | "error" | "log" | "warning" | undefined;
    since?: number | undefined;
    limit?: number | undefined;
}>;
export declare const RuntimeConsoleLogsDataSchema: z.ZodObject<{
    logs: z.ZodArray<z.ZodObject<{
        level: z.ZodString;
        text: z.ZodString;
        timestamp: z.ZodNumber;
        stackTrace: z.ZodOptional<z.ZodArray<z.ZodObject<{
            functionName: z.ZodString;
            url: z.ZodString;
            lineNumber: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            functionName: string;
            url: string;
            lineNumber: number;
        }, {
            functionName: string;
            url: string;
            lineNumber: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        level: string;
        text: string;
        timestamp: number;
        stackTrace?: {
            functionName: string;
            url: string;
            lineNumber: number;
        }[] | undefined;
    }, {
        level: string;
        text: string;
        timestamp: number;
        stackTrace?: {
            functionName: string;
            url: string;
            lineNumber: number;
        }[] | undefined;
    }>, "many">;
    total: z.ZodNumber;
    truncated: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    truncated: boolean;
    logs: {
        level: string;
        text: string;
        timestamp: number;
        stackTrace?: {
            functionName: string;
            url: string;
            lineNumber: number;
        }[] | undefined;
    }[];
    total: number;
}, {
    truncated: boolean;
    logs: {
        level: string;
        text: string;
        timestamp: number;
        stackTrace?: {
            functionName: string;
            url: string;
            lineNumber: number;
        }[] | undefined;
    }[];
    total: number;
}>;
export declare const RuntimeConsoleLogsOutputSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    data: z.ZodOptional<z.ZodObject<{
        logs: z.ZodArray<z.ZodObject<{
            level: z.ZodString;
            text: z.ZodString;
            timestamp: z.ZodNumber;
            stackTrace: z.ZodOptional<z.ZodArray<z.ZodObject<{
                functionName: z.ZodString;
                url: z.ZodString;
                lineNumber: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                functionName: string;
                url: string;
                lineNumber: number;
            }, {
                functionName: string;
                url: string;
                lineNumber: number;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            level: string;
            text: string;
            timestamp: number;
            stackTrace?: {
                functionName: string;
                url: string;
                lineNumber: number;
            }[] | undefined;
        }, {
            level: string;
            text: string;
            timestamp: number;
            stackTrace?: {
                functionName: string;
                url: string;
                lineNumber: number;
            }[] | undefined;
        }>, "many">;
        total: z.ZodNumber;
        truncated: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        truncated: boolean;
        logs: {
            level: string;
            text: string;
            timestamp: number;
            stackTrace?: {
                functionName: string;
                url: string;
                lineNumber: number;
            }[] | undefined;
        }[];
        total: number;
    }, {
        truncated: boolean;
        logs: {
            level: string;
            text: string;
            timestamp: number;
            stackTrace?: {
                functionName: string;
                url: string;
                lineNumber: number;
            }[] | undefined;
        }[];
        total: number;
    }>>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
    }, {
        code: string;
        message: string;
    }>>;
    meta: z.ZodObject<{
        serverVersion: z.ZodString;
        generatedAt: z.ZodString;
        truncated: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        serverVersion: string;
        generatedAt: string;
        truncated: boolean;
    }, {
        serverVersion: string;
        generatedAt: string;
        truncated: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    meta: {
        serverVersion: string;
        generatedAt: string;
        truncated: boolean;
    };
    error?: {
        code: string;
        message: string;
    } | undefined;
    data?: {
        truncated: boolean;
        logs: {
            level: string;
            text: string;
            timestamp: number;
            stackTrace?: {
                functionName: string;
                url: string;
                lineNumber: number;
            }[] | undefined;
        }[];
        total: number;
    } | undefined;
}, {
    ok: boolean;
    meta: {
        serverVersion: string;
        generatedAt: string;
        truncated: boolean;
    };
    error?: {
        code: string;
        message: string;
    } | undefined;
    data?: {
        truncated: boolean;
        logs: {
            level: string;
            text: string;
            timestamp: number;
            stackTrace?: {
                functionName: string;
                url: string;
                lineNumber: number;
            }[] | undefined;
        }[];
        total: number;
    } | undefined;
}>;
export type RuntimeConsoleLogsInput = z.infer<typeof RuntimeConsoleLogsInputSchema>;
export type RuntimeConsoleLogsData = z.infer<typeof RuntimeConsoleLogsDataSchema>;
//# sourceMappingURL=runtime-console-logs.d.ts.map
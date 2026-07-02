/**
 * Schemas for runtime_status tool.
 */
import { z } from 'zod';
export declare const RuntimeStatusInputSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare const RuntimeStatusDataSchema: z.ZodObject<{
    status: z.ZodEnum<["connected", "disconnected"]>;
    scene: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    resolution: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
    }, {
        width: number;
        height: number;
    }>>>;
    visibleSize: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
    }, {
        width: number;
        height: number;
    }>>>;
    fps: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    pageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastSeenAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "connected" | "disconnected";
    error?: string | undefined;
    scene?: string | null | undefined;
    resolution?: {
        width: number;
        height: number;
    } | null | undefined;
    visibleSize?: {
        width: number;
        height: number;
    } | null | undefined;
    fps?: number | null | undefined;
    pageUrl?: string | null | undefined;
    connectedAt?: string | null | undefined;
    lastSeenAt?: string | null | undefined;
}, {
    status: "connected" | "disconnected";
    error?: string | undefined;
    scene?: string | null | undefined;
    resolution?: {
        width: number;
        height: number;
    } | null | undefined;
    visibleSize?: {
        width: number;
        height: number;
    } | null | undefined;
    fps?: number | null | undefined;
    pageUrl?: string | null | undefined;
    connectedAt?: string | null | undefined;
    lastSeenAt?: string | null | undefined;
}>;
export declare const RuntimeStatusOutputSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    data: z.ZodOptional<z.ZodObject<{
        status: z.ZodEnum<["connected", "disconnected"]>;
        scene: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        resolution: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
        }, {
            width: number;
            height: number;
        }>>>;
        visibleSize: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
        }, {
            width: number;
            height: number;
        }>>>;
        fps: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        pageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        connectedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lastSeenAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "connected" | "disconnected";
        error?: string | undefined;
        scene?: string | null | undefined;
        resolution?: {
            width: number;
            height: number;
        } | null | undefined;
        visibleSize?: {
            width: number;
            height: number;
        } | null | undefined;
        fps?: number | null | undefined;
        pageUrl?: string | null | undefined;
        connectedAt?: string | null | undefined;
        lastSeenAt?: string | null | undefined;
    }, {
        status: "connected" | "disconnected";
        error?: string | undefined;
        scene?: string | null | undefined;
        resolution?: {
            width: number;
            height: number;
        } | null | undefined;
        visibleSize?: {
            width: number;
            height: number;
        } | null | undefined;
        fps?: number | null | undefined;
        pageUrl?: string | null | undefined;
        connectedAt?: string | null | undefined;
        lastSeenAt?: string | null | undefined;
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
        status: "connected" | "disconnected";
        error?: string | undefined;
        scene?: string | null | undefined;
        resolution?: {
            width: number;
            height: number;
        } | null | undefined;
        visibleSize?: {
            width: number;
            height: number;
        } | null | undefined;
        fps?: number | null | undefined;
        pageUrl?: string | null | undefined;
        connectedAt?: string | null | undefined;
        lastSeenAt?: string | null | undefined;
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
        status: "connected" | "disconnected";
        error?: string | undefined;
        scene?: string | null | undefined;
        resolution?: {
            width: number;
            height: number;
        } | null | undefined;
        visibleSize?: {
            width: number;
            height: number;
        } | null | undefined;
        fps?: number | null | undefined;
        pageUrl?: string | null | undefined;
        connectedAt?: string | null | undefined;
        lastSeenAt?: string | null | undefined;
    } | undefined;
}>;
export type RuntimeStatusInput = z.infer<typeof RuntimeStatusInputSchema>;
export type RuntimeStatusData = z.infer<typeof RuntimeStatusDataSchema>;
//# sourceMappingURL=runtime-status.d.ts.map
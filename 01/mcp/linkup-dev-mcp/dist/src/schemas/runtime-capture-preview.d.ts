/**
 * Schemas for runtime_capture_preview tool.
 */
import { z } from 'zod';
export declare const RuntimeCapturePreviewInputSchema: z.ZodObject<{
    format: z.ZodDefault<z.ZodOptional<z.ZodEnum<["png", "jpeg"]>>>;
    quality: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    format: "png" | "jpeg";
    quality?: number | undefined;
}, {
    format?: "png" | "jpeg" | undefined;
    quality?: number | undefined;
}>;
export declare const RuntimeCapturePreviewDataSchema: z.ZodObject<{
    format: z.ZodString;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    base64: z.ZodString;
    sizeBytes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    base64: string;
    format: string;
    sizeBytes: number;
    width?: number | undefined;
    height?: number | undefined;
}, {
    base64: string;
    format: string;
    sizeBytes: number;
    width?: number | undefined;
    height?: number | undefined;
}>;
export declare const RuntimeCapturePreviewOutputSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    data: z.ZodOptional<z.ZodObject<{
        format: z.ZodString;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        base64: z.ZodString;
        sizeBytes: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        base64: string;
        format: string;
        sizeBytes: number;
        width?: number | undefined;
        height?: number | undefined;
    }, {
        base64: string;
        format: string;
        sizeBytes: number;
        width?: number | undefined;
        height?: number | undefined;
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
        base64: string;
        format: string;
        sizeBytes: number;
        width?: number | undefined;
        height?: number | undefined;
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
        base64: string;
        format: string;
        sizeBytes: number;
        width?: number | undefined;
        height?: number | undefined;
    } | undefined;
}>;
export type RuntimeCapturePreviewInput = z.infer<typeof RuntimeCapturePreviewInputSchema>;
export type RuntimeCapturePreviewData = z.infer<typeof RuntimeCapturePreviewDataSchema>;
//# sourceMappingURL=runtime-capture-preview.d.ts.map
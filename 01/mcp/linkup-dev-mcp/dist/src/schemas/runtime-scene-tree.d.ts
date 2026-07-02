/**
 * Schemas for runtime_scene_tree tool.
 */
import { z } from 'zod';
export declare const RuntimeSceneTreeInputSchema: z.ZodObject<{
    maxDepth: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    maxNodes: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    maxDepth: number;
    maxNodes: number;
}, {
    maxDepth?: number | undefined;
    maxNodes?: number | undefined;
}>;
export declare const RuntimeSceneTreeDataSchema: z.ZodObject<{
    tree: z.ZodNullable<z.ZodType<any, z.ZodTypeDef, any>>;
    totalNodes: z.ZodNumber;
    truncated: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    truncated: boolean;
    totalNodes: number;
    tree?: any;
}, {
    truncated: boolean;
    totalNodes: number;
    tree?: any;
}>;
export declare const RuntimeSceneTreeOutputSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    data: z.ZodOptional<z.ZodObject<{
        tree: z.ZodNullable<z.ZodType<any, z.ZodTypeDef, any>>;
        totalNodes: z.ZodNumber;
        truncated: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        truncated: boolean;
        totalNodes: number;
        tree?: any;
    }, {
        truncated: boolean;
        totalNodes: number;
        tree?: any;
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
        totalNodes: number;
        tree?: any;
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
        totalNodes: number;
        tree?: any;
    } | undefined;
}>;
export type RuntimeSceneTreeInput = z.infer<typeof RuntimeSceneTreeInputSchema>;
export type RuntimeSceneTreeData = z.infer<typeof RuntimeSceneTreeDataSchema>;
//# sourceMappingURL=runtime-scene-tree.d.ts.map
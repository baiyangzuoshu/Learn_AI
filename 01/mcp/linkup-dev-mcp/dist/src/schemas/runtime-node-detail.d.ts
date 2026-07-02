/**
 * Schemas for runtime_node_detail tool.
 */
import { z } from 'zod';
export declare const RuntimeNodeDetailInputSchema: z.ZodObject<{
    nodePath: z.ZodString;
}, "strip", z.ZodTypeAny, {
    nodePath: string;
}, {
    nodePath: string;
}>;
export declare const RuntimeNodeDetailDataSchema: z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    active: z.ZodBoolean;
    position: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>>>;
    size: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
    }, {
        width: number;
        height: number;
    }>>>;
    opacity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    anchorPoint: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>>>;
    components: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        enabled: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        enabled: boolean;
    }, {
        name: string;
        enabled: boolean;
    }>, "many">;
    childrenCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    path: string;
    name: string;
    active: boolean;
    components: {
        name: string;
        enabled: boolean;
    }[];
    childrenCount: number;
    position?: {
        x: number;
        y: number;
    } | null | undefined;
    size?: {
        width: number;
        height: number;
    } | null | undefined;
    opacity?: number | null | undefined;
    anchorPoint?: {
        x: number;
        y: number;
    } | null | undefined;
}, {
    path: string;
    name: string;
    active: boolean;
    components: {
        name: string;
        enabled: boolean;
    }[];
    childrenCount: number;
    position?: {
        x: number;
        y: number;
    } | null | undefined;
    size?: {
        width: number;
        height: number;
    } | null | undefined;
    opacity?: number | null | undefined;
    anchorPoint?: {
        x: number;
        y: number;
    } | null | undefined;
}>;
export declare const RuntimeNodeDetailOutputSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    data: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        active: z.ZodBoolean;
        position: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>>>;
        size: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
        }, {
            width: number;
            height: number;
        }>>>;
        opacity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        anchorPoint: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>>>;
        components: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            enabled: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            name: string;
            enabled: boolean;
        }, {
            name: string;
            enabled: boolean;
        }>, "many">;
        childrenCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        path: string;
        name: string;
        active: boolean;
        components: {
            name: string;
            enabled: boolean;
        }[];
        childrenCount: number;
        position?: {
            x: number;
            y: number;
        } | null | undefined;
        size?: {
            width: number;
            height: number;
        } | null | undefined;
        opacity?: number | null | undefined;
        anchorPoint?: {
            x: number;
            y: number;
        } | null | undefined;
    }, {
        path: string;
        name: string;
        active: boolean;
        components: {
            name: string;
            enabled: boolean;
        }[];
        childrenCount: number;
        position?: {
            x: number;
            y: number;
        } | null | undefined;
        size?: {
            width: number;
            height: number;
        } | null | undefined;
        opacity?: number | null | undefined;
        anchorPoint?: {
            x: number;
            y: number;
        } | null | undefined;
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
        path: string;
        name: string;
        active: boolean;
        components: {
            name: string;
            enabled: boolean;
        }[];
        childrenCount: number;
        position?: {
            x: number;
            y: number;
        } | null | undefined;
        size?: {
            width: number;
            height: number;
        } | null | undefined;
        opacity?: number | null | undefined;
        anchorPoint?: {
            x: number;
            y: number;
        } | null | undefined;
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
        path: string;
        name: string;
        active: boolean;
        components: {
            name: string;
            enabled: boolean;
        }[];
        childrenCount: number;
        position?: {
            x: number;
            y: number;
        } | null | undefined;
        size?: {
            width: number;
            height: number;
        } | null | undefined;
        opacity?: number | null | undefined;
        anchorPoint?: {
            x: number;
            y: number;
        } | null | undefined;
    } | undefined;
}>;
export type RuntimeNodeDetailInput = z.infer<typeof RuntimeNodeDetailInputSchema>;
export type RuntimeNodeDetailData = z.infer<typeof RuntimeNodeDetailDataSchema>;
//# sourceMappingURL=runtime-node-detail.d.ts.map
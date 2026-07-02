/**
 * Input/output schemas for inspect_ui_prefab tool.
 */
import { z } from 'zod';
export declare const InspectUiPrefabInputSchema: z.ZodObject<{
    uiName: z.ZodString;
    maxDepth: z.ZodOptional<z.ZodNumber>;
    includeInactive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    uiName: string;
    includeInactive: boolean;
    maxDepth?: number | undefined;
}, {
    uiName: string;
    maxDepth?: number | undefined;
    includeInactive?: boolean | undefined;
}>;
export type InspectUiPrefabInput = z.infer<typeof InspectUiPrefabInputSchema>;
export declare const PrefabNodeSchema: z.ZodType<any>;
export declare const InspectUiPrefabOutputSchema: z.ZodObject<{
    uiName: z.ZodString;
    prefabRelPath: z.ZodString;
    rootNodeName: z.ZodString;
    controllerRelPath: z.ZodOptional<z.ZodString>;
    registrationStatus: z.ZodEnum<["global", "local", "unregistered", "ambiguous"]>;
    nodeTree: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        active: z.ZodOptional<z.ZodBoolean>;
        depth: z.ZodNumber;
        components: z.ZodOptional<z.ZodArray<z.ZodObject<{
            typeName: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            typeName: string;
        }, {
            typeName: string;
        }>, "many">>;
        position: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>>;
        size: z.ZodOptional<z.ZodObject<{
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
        }, {
            width: number;
            height: number;
        }>>;
        children: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        name: string;
        depth: number;
        active?: boolean | undefined;
        position?: {
            x: number;
            y: number;
        } | undefined;
        size?: {
            width: number;
            height: number;
        } | undefined;
        components?: {
            typeName: string;
        }[] | undefined;
        children?: any[] | undefined;
    }, {
        path: string;
        name: string;
        depth: number;
        active?: boolean | undefined;
        position?: {
            x: number;
            y: number;
        } | undefined;
        size?: {
            width: number;
            height: number;
        } | undefined;
        components?: {
            typeName: string;
        }[] | undefined;
        children?: any[] | undefined;
    }>>;
    nodeCount: z.ZodNumber;
    returnedNodeCount: z.ZodNumber;
    diagnostics: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
}, "strip", z.ZodTypeAny, {
    uiName: string;
    prefabRelPath: string;
    rootNodeName: string;
    registrationStatus: "global" | "local" | "unregistered" | "ambiguous";
    nodeCount: number;
    returnedNodeCount: number;
    diagnostics?: any[] | undefined;
    controllerRelPath?: string | undefined;
    nodeTree?: {
        path: string;
        name: string;
        depth: number;
        active?: boolean | undefined;
        position?: {
            x: number;
            y: number;
        } | undefined;
        size?: {
            width: number;
            height: number;
        } | undefined;
        components?: {
            typeName: string;
        }[] | undefined;
        children?: any[] | undefined;
    } | undefined;
}, {
    uiName: string;
    prefabRelPath: string;
    rootNodeName: string;
    registrationStatus: "global" | "local" | "unregistered" | "ambiguous";
    nodeCount: number;
    returnedNodeCount: number;
    diagnostics?: any[] | undefined;
    controllerRelPath?: string | undefined;
    nodeTree?: {
        path: string;
        name: string;
        depth: number;
        active?: boolean | undefined;
        position?: {
            x: number;
            y: number;
        } | undefined;
        size?: {
            width: number;
            height: number;
        } | undefined;
        components?: {
            typeName: string;
        }[] | undefined;
        children?: any[] | undefined;
    } | undefined;
}>;
export type InspectUiPrefabOutput = z.infer<typeof InspectUiPrefabOutputSchema>;
//# sourceMappingURL=inspect-ui-prefab.d.ts.map
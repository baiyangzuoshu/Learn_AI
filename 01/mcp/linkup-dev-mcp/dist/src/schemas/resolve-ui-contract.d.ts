/**
 * Input/output schemas for resolve_ui_contract tool.
 */
import { z } from 'zod';
export declare const ResolveUiContractInputSchema: z.ZodObject<{
    uiName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    uiName: string;
}, {
    uiName: string;
}>;
export type ResolveUiContractInput = z.infer<typeof ResolveUiContractInputSchema>;
export declare const NodePathEntrySchema: z.ZodObject<{
    path: z.ZodString;
    functionName: z.ZodString;
    line: z.ZodNumber;
    isDynamic: z.ZodBoolean;
    kind: z.ZodEnum<["lookup", "button", "delay-button", "mouse"]>;
    exists: z.ZodNullable<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    path: string;
    functionName: string;
    line: number;
    isDynamic: boolean;
    kind: "lookup" | "button" | "delay-button" | "mouse";
    exists: boolean | null;
}, {
    path: string;
    functionName: string;
    line: number;
    isDynamic: boolean;
    kind: "lookup" | "button" | "delay-button" | "mouse";
    exists: boolean | null;
}>;
export declare const ResolveUiContractOutputSchema: z.ZodObject<{
    uiName: z.ZodString;
    prefabBasename: z.ZodString;
    prefabRelPath: z.ZodString;
    rootNodeName: z.ZodString;
    uiNameKey: z.ZodOptional<z.ZodString>;
    uiNameValue: z.ZodOptional<z.ZodString>;
    uiNameLine: z.ZodOptional<z.ZodNumber>;
    uiControllerNameKey: z.ZodOptional<z.ZodString>;
    uiControllerNameValue: z.ZodOptional<z.ZodString>;
    controllerRelPath: z.ZodOptional<z.ZodString>;
    controllerClassName: z.ZodOptional<z.ZodString>;
    uiControllerHandler: z.ZodOptional<z.ZodString>;
    uiControllerLine: z.ZodOptional<z.ZodNumber>;
    nodePaths: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        functionName: z.ZodString;
        line: z.ZodNumber;
        isDynamic: z.ZodBoolean;
        kind: z.ZodEnum<["lookup", "button", "delay-button", "mouse"]>;
        exists: z.ZodNullable<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        functionName: string;
        line: number;
        isDynamic: boolean;
        kind: "lookup" | "button" | "delay-button" | "mouse";
        exists: boolean | null;
    }, {
        path: string;
        functionName: string;
        line: number;
        isDynamic: boolean;
        kind: "lookup" | "button" | "delay-button" | "mouse";
        exists: boolean | null;
    }>, "many">;
    status: z.ZodEnum<["complete", "incomplete", "ambiguous", "not_found"]>;
    diagnostics: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "ambiguous" | "complete" | "incomplete" | "not_found";
    uiName: string;
    prefabRelPath: string;
    rootNodeName: string;
    prefabBasename: string;
    nodePaths: {
        path: string;
        functionName: string;
        line: number;
        isDynamic: boolean;
        kind: "lookup" | "button" | "delay-button" | "mouse";
        exists: boolean | null;
    }[];
    diagnostics?: any[] | undefined;
    controllerRelPath?: string | undefined;
    uiNameKey?: string | undefined;
    uiNameValue?: string | undefined;
    uiNameLine?: number | undefined;
    uiControllerNameKey?: string | undefined;
    uiControllerNameValue?: string | undefined;
    controllerClassName?: string | undefined;
    uiControllerHandler?: string | undefined;
    uiControllerLine?: number | undefined;
}, {
    status: "ambiguous" | "complete" | "incomplete" | "not_found";
    uiName: string;
    prefabRelPath: string;
    rootNodeName: string;
    prefabBasename: string;
    nodePaths: {
        path: string;
        functionName: string;
        line: number;
        isDynamic: boolean;
        kind: "lookup" | "button" | "delay-button" | "mouse";
        exists: boolean | null;
    }[];
    diagnostics?: any[] | undefined;
    controllerRelPath?: string | undefined;
    uiNameKey?: string | undefined;
    uiNameValue?: string | undefined;
    uiNameLine?: number | undefined;
    uiControllerNameKey?: string | undefined;
    uiControllerNameValue?: string | undefined;
    controllerClassName?: string | undefined;
    uiControllerHandler?: string | undefined;
    uiControllerLine?: number | undefined;
}>;
export type ResolveUiContractOutput = z.infer<typeof ResolveUiContractOutputSchema>;
//# sourceMappingURL=resolve-ui-contract.d.ts.map
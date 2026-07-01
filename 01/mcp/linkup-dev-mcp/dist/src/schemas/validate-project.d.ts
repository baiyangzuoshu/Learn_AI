/**
 * Input/output schemas for validate_project tool.
 */
import { z } from 'zod';
export declare const ValidateProjectInputSchema: z.ZodObject<{
    rules: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    includeBaselined: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    maxDiagnostics: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    includeBaselined: boolean;
    maxDiagnostics?: number | undefined;
    rules?: string[] | undefined;
}, {
    maxDiagnostics?: number | undefined;
    rules?: string[] | undefined;
    includeBaselined?: boolean | undefined;
}>;
export type ValidateProjectInput = z.infer<typeof ValidateProjectInputSchema>;
export declare const DiagnosticSchema: z.ZodObject<{
    ruleId: z.ZodString;
    severity: z.ZodString;
    file: z.ZodOptional<z.ZodString>;
    line: z.ZodOptional<z.ZodNumber>;
    subject: z.ZodString;
    message: z.ZodString;
    suggestion: z.ZodOptional<z.ZodString>;
    fingerprint: z.ZodOptional<z.ZodString>;
    baselined: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    message: string;
    ruleId: string;
    severity: string;
    subject: string;
    file?: string | undefined;
    line?: number | undefined;
    suggestion?: string | undefined;
    fingerprint?: string | undefined;
    baselined?: boolean | undefined;
}, {
    message: string;
    ruleId: string;
    severity: string;
    subject: string;
    file?: string | undefined;
    line?: number | undefined;
    suggestion?: string | undefined;
    fingerprint?: string | undefined;
    baselined?: boolean | undefined;
}>;
export declare const ValidateProjectOutputSchema: z.ZodObject<{
    diagnostics: z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        severity: z.ZodString;
        file: z.ZodOptional<z.ZodString>;
        line: z.ZodOptional<z.ZodNumber>;
        subject: z.ZodString;
        message: z.ZodString;
        suggestion: z.ZodOptional<z.ZodString>;
        fingerprint: z.ZodOptional<z.ZodString>;
        baselined: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        ruleId: string;
        severity: string;
        subject: string;
        file?: string | undefined;
        line?: number | undefined;
        suggestion?: string | undefined;
        fingerprint?: string | undefined;
        baselined?: boolean | undefined;
    }, {
        message: string;
        ruleId: string;
        severity: string;
        subject: string;
        file?: string | undefined;
        line?: number | undefined;
        suggestion?: string | undefined;
        fingerprint?: string | undefined;
        baselined?: boolean | undefined;
    }>, "many">;
    summary: z.ZodObject<{
        errors: z.ZodNumber;
        warnings: z.ZodNumber;
        infos: z.ZodNumber;
        baselined: z.ZodOptional<z.ZodNumber>;
        returnedDiagnostics: z.ZodNumber;
        totalDiagnostics: z.ZodNumber;
        passedRules: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        errors: number;
        warnings: number;
        infos: number;
        returnedDiagnostics: number;
        totalDiagnostics: number;
        baselined?: number | undefined;
        passedRules?: number | undefined;
    }, {
        errors: number;
        warnings: number;
        infos: number;
        returnedDiagnostics: number;
        totalDiagnostics: number;
        baselined?: number | undefined;
        passedRules?: number | undefined;
    }>;
    executedRules: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    diagnostics: {
        message: string;
        ruleId: string;
        severity: string;
        subject: string;
        file?: string | undefined;
        line?: number | undefined;
        suggestion?: string | undefined;
        fingerprint?: string | undefined;
        baselined?: boolean | undefined;
    }[];
    summary: {
        errors: number;
        warnings: number;
        infos: number;
        returnedDiagnostics: number;
        totalDiagnostics: number;
        baselined?: number | undefined;
        passedRules?: number | undefined;
    };
    executedRules: string[];
}, {
    diagnostics: {
        message: string;
        ruleId: string;
        severity: string;
        subject: string;
        file?: string | undefined;
        line?: number | undefined;
        suggestion?: string | undefined;
        fingerprint?: string | undefined;
        baselined?: boolean | undefined;
    }[];
    summary: {
        errors: number;
        warnings: number;
        infos: number;
        returnedDiagnostics: number;
        totalDiagnostics: number;
        baselined?: number | undefined;
        passedRules?: number | undefined;
    };
    executedRules: string[];
}>;
export type ValidateProjectOutput = z.infer<typeof ValidateProjectOutputSchema>;
//# sourceMappingURL=validate-project.d.ts.map
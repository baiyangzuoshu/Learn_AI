/**
 * ProjectContext - the sole project access entry point for all Tools and Resources.
 *
 * Encapsulates G1 public API, enforces path boundary protection,
 * and provides project index and check results.
 */
import { type StructuredError } from './errors.js';
import type { AppConfig } from './config.js';
export interface ProjectIndex {
    projectRoot: string;
    prefabs: Array<{
        relPath: string;
        absPath: string;
        parsed: any;
        error?: string;
    }>;
    controllers: Array<{
        relPath: string;
        absPath: string;
        content: string;
    }>;
    constants: {
        uiNames: Record<string, string>;
        uiControllerNames: Record<string, string>;
        uiNameLines?: Record<string, number>;
    };
    uiController: {
        registrations: Array<{
            uiName: string;
            controllerName: string;
            handler: string;
            controllerImport: string;
            line?: number;
        }>;
    };
}
export interface CheckResult {
    diagnostics: any[];
    summary: {
        total: number;
        errors: number;
        warnings: number;
        infos: number;
        baselined?: number;
        baselineDedup?: number;
        baselineExpired?: number;
        passedRules?: number;
        activeRules?: string[];
    };
}
export interface ProjectContext {
    readonly projectRoot: string;
    readonly baselinePath: string;
    readonly maxTreeDepth: number;
    readonly maxTreeNodes: number;
    readonly maxDiagnostics: number;
    runChecks(input: {
        ruleIds?: string[];
    }): Promise<CheckResult>;
    getIndex(): ProjectIndex;
    resolveKnownProjectFile(relativePath: string): string;
}
/**
 * Validate a relative path for security.
 * Rejects: absolute paths, ".." segments, NUL bytes, URL-encoded escapes, mixed separators.
 */
export declare function validateRelativePath(pathStr: string): {
    valid: true;
} | {
    valid: false;
    error: string;
};
/**
 * Check that a resolved path is within the project root.
 * Uses realpath to resolve symlinks and verifies containment.
 */
export declare function isWithinRoot(resolvedPath: string, projectRoot: string): boolean;
/**
 * Create a ProjectContext from configuration.
 * Uses dynamic import for G1 public API to support dependency injection in tests.
 */
export declare function createProjectContext(config: AppConfig, g1Module?: {
    runChecks: (opts: any) => Promise<any>;
    buildProjectIndex: (root: string) => any;
    parsePrefab: (content: string, path: string) => any;
    getRootNodeName: (parsed: any) => string | null;
    walkNodes: (parsed: any) => any[];
    getComponents: (parsed: any) => any[];
    nodeHasComponent: (parsed: any, path: string, type: string) => boolean;
    extractNodePaths: (content: string, path: string) => any[];
    listRules: () => string[];
}): Promise<{
    context?: ProjectContext;
    error?: StructuredError;
}>;
export declare function importG1(): Promise<{
    default: typeof import("linkup-check");
    runChecks(options: import("linkup-check").RunChecksOptions): Promise<import("linkup-check").CheckResult>;
    listRules(): string[];
    buildProjectIndex(projectRoot: string): import("linkup-check").ProjectIndex;
    parsePrefab(jsonStr: string, filePath: string): import("linkup-check").ParsedPrefab | {
        error: string;
    };
    getRootNodeName(parsed: import("linkup-check").ParsedPrefab): string | null;
    walkNodes(parsed: import("linkup-check").ParsedPrefab): import("linkup-check").WalkNode[];
    getComponents(parsed: import("linkup-check").ParsedPrefab): Array<{
        component: Record<string, unknown>;
        typeName: string;
        nodeIdx: number;
        idx: number;
    }>;
    nodeHasComponent(parsed: import("linkup-check").ParsedPrefab, targetPath: string, componentType: string): boolean;
    extractNodePaths(content: string, filePath: string): import("linkup-check").ExtractedPath[];
    createDiagnostic(...args: unknown[]): unknown;
    applyBaseline(...args: unknown[]): unknown;
    computeSummary(...args: unknown[]): unknown;
    formatText(...args: unknown[]): string;
    formatJSON(...args: unknown[]): string;
}>;
//# sourceMappingURL=project-context.d.ts.map
/**
 * Type declarations for linkup-check (G1 public API).
 * These are hand-written declarations matching the actual JS exports.
 */

declare module 'linkup-check' {
  export interface RunChecksOptions {
    projectRoot: string;
    ruleIds?: string[];
    baselinePath?: string;
  }

  export interface Diagnostic {
    ruleId: string;
    severity: string;
    file?: string;
    line?: number;
    subject: string;
    message: string;
    suggestion?: string;
    fingerprint?: string;
    baselined?: boolean;
  }

  export interface CheckResult {
    diagnostics: Diagnostic[];
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

  export function runChecks(options: RunChecksOptions): Promise<CheckResult>;
  export function listRules(): string[];

  export interface ProjectIndex {
    projectRoot: string;
    prefabs: Array<{
      relPath: string;
      absPath: string;
      parsed: ParsedPrefab | null;
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

  export function buildProjectIndex(projectRoot: string): ProjectIndex;

  export interface ParsedPrefab {
    root: Record<string, unknown>;
    nodes: Record<string, unknown>[];
    components: Record<string, unknown>[];
    all: Record<string, unknown>[];
  }

  export function parsePrefab(jsonStr: string, filePath: string): ParsedPrefab | { error: string };
  export function getRootNodeName(parsed: ParsedPrefab): string | null;

  export interface WalkNode {
    node: Record<string, unknown>;
    name: string;
    depth: number;
    path: string;
  }

  export function walkNodes(parsed: ParsedPrefab): WalkNode[];
  export function getComponents(parsed: ParsedPrefab): Array<{
    component: Record<string, unknown>;
    typeName: string;
    nodeIdx: number;
    idx: number;
  }>;
  export function nodeHasComponent(parsed: ParsedPrefab, targetPath: string, componentType: string): boolean;

  export interface ExtractedPath {
    path: string;
    functionName: string;
    line: number;
    isDynamic: boolean;
    file: string;
  }

  export function extractNodePaths(content: string, filePath: string): ExtractedPath[];

  export function createDiagnostic(...args: unknown[]): unknown;
  export function applyBaseline(...args: unknown[]): unknown;
  export function computeSummary(...args: unknown[]): unknown;
  export function formatText(...args: unknown[]): string;
  export function formatJSON(...args: unknown[]): string;
}

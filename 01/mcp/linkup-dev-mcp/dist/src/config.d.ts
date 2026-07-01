/**
 * Fixed configuration loader for linkup-dev-mcp.
 *
 * Loads linkup-mcp.config.json relative to the package directory,
 * resolves projectRoot and baselinePath via realpath, and validates
 * the project structure.
 */
import { type StructuredError } from './errors.js';
export interface AppConfig {
    projectRoot: string;
    baselinePath: string;
    maxTreeDepth: number;
    maxTreeNodes: number;
    maxDiagnostics: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}
export interface ConfigResult {
    config?: AppConfig;
    error?: StructuredError;
}
/**
 * Load and validate the fixed configuration.
 * All paths are resolved relative to the config file directory and then realpath'd.
 */
export declare function loadConfig(): ConfigResult;
//# sourceMappingURL=config.d.ts.map
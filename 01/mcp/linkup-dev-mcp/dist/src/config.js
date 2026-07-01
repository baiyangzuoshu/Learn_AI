/**
 * Fixed configuration loader for linkup-dev-mcp.
 *
 * Loads linkup-mcp.config.json relative to the package directory,
 * resolves projectRoot and baselinePath via realpath, and validates
 * the project structure.
 */
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ErrorCode, createError } from './errors.js';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
// dist/src/config.js -> go up 2 levels to package root
const PACKAGE_ROOT = resolve(__dirname, '..', '..');
const CONFIG_PATH = join(PACKAGE_ROOT, 'linkup-mcp.config.json');
/**
 * Load and validate the fixed configuration.
 * All paths are resolved relative to the config file directory and then realpath'd.
 */
export function loadConfig() {
    // Read config file
    if (!existsSync(CONFIG_PATH)) {
        return { error: createError(ErrorCode.CONFIG_INVALID, 'Config file not found: linkup-mcp.config.json') };
    }
    let raw;
    try {
        raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    }
    catch (e) {
        return { error: createError(ErrorCode.CONFIG_INVALID, `Invalid JSON in config: ${e.message}`) };
    }
    // Validate required fields
    if (typeof raw.projectRoot !== 'string' || raw.projectRoot.length === 0) {
        return { error: createError(ErrorCode.CONFIG_INVALID, 'projectRoot is required and must be a non-empty string') };
    }
    if (typeof raw.baselinePath !== 'string' || raw.baselinePath.length === 0) {
        return { error: createError(ErrorCode.CONFIG_INVALID, 'baselinePath is required and must be a non-empty string') };
    }
    // Resolve relative paths from config file directory
    const configDir = PACKAGE_ROOT;
    const projectRoot = isAbsolute(raw.projectRoot)
        ? raw.projectRoot
        : resolve(configDir, raw.projectRoot);
    const baselinePath = isAbsolute(raw.baselinePath)
        ? raw.baselinePath
        : resolve(configDir, raw.baselinePath);
    // Resolve symlinks and fix paths
    let resolvedProjectRoot;
    try {
        resolvedProjectRoot = realpathSync(projectRoot);
    }
    catch {
        return { error: createError(ErrorCode.PROJECT_NOT_FOUND, 'Project root not found') };
    }
    let resolvedBaselinePath;
    try {
        resolvedBaselinePath = realpathSync(baselinePath);
    }
    catch {
        // Baseline may not exist yet; use resolved path as-is
        resolvedBaselinePath = baselinePath;
    }
    // Validate project structure
    const requiredDirs = [
        join(resolvedProjectRoot, 'assets'),
        join(resolvedProjectRoot, 'assets', 'Scripts'),
        join(resolvedProjectRoot, 'assets', 'BundleLLK', 'GUI'),
    ];
    const requiredFiles = [
        join(resolvedProjectRoot, 'project.json'),
    ];
    for (const dir of requiredDirs) {
        if (!existsSync(dir)) {
            return {
                error: createError(ErrorCode.PROJECT_NOT_FOUND, 'Not a valid LinkUpClient project (missing required directories)'),
            };
        }
    }
    for (const file of requiredFiles) {
        if (!existsSync(file)) {
            return {
                error: createError(ErrorCode.PROJECT_NOT_FOUND, 'Not a valid LinkUpClient project (missing project.json)'),
            };
        }
    }
    // Parse numeric fields with defaults
    const maxTreeDepth = typeof raw.maxTreeDepth === 'number' ? raw.maxTreeDepth : 8;
    const maxTreeNodes = typeof raw.maxTreeNodes === 'number' ? raw.maxTreeNodes : 2000;
    const maxDiagnostics = typeof raw.maxDiagnostics === 'number' ? raw.maxDiagnostics : 500;
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    const logLevel = validLogLevels.includes(raw.logLevel) ? raw.logLevel : 'info';
    return {
        config: {
            projectRoot: resolvedProjectRoot,
            baselinePath: resolvedBaselinePath,
            maxTreeDepth,
            maxTreeNodes,
            maxDiagnostics,
            logLevel,
        },
    };
}
//# sourceMappingURL=config.js.map
/**
 * ProjectContext - the sole project access entry point for all Tools and Resources.
 *
 * Encapsulates G1 public API, enforces path boundary protection,
 * and provides project index and check results.
 */
import { realpathSync, lstatSync } from 'node:fs';
import { resolve, relative, isAbsolute, normalize } from 'node:path';
import { ErrorCode, createError } from './errors.js';
import { createLogger } from './logger.js';
const logger = createLogger('ProjectContext');
// Whitelist of known project files that can be resolved internally
const KNOWN_FILE_WHITELIST = [
    'project.json',
    'assets/Scripts/Constant.ts',
    'assets/Scripts/Manager/UIController.ts',
];
/**
 * Validate a relative path for security.
 * Rejects: absolute paths, ".." segments, NUL bytes, URL-encoded escapes, mixed separators.
 */
export function validateRelativePath(pathStr) {
    if (!pathStr || typeof pathStr !== 'string') {
        return { valid: false, error: 'Path must be a non-empty string' };
    }
    // Reject NUL bytes
    if (pathStr.includes('\0')) {
        return { valid: false, error: 'Path contains NUL byte' };
    }
    // Reject absolute paths
    if (isAbsolute(pathStr)) {
        return { valid: false, error: 'Absolute paths are not allowed' };
    }
    // Reject URL-encoded sequences that could be path traversal
    if (/%2e|%2E|%2f|%2F|%5c|%5C/i.test(pathStr)) {
        return { valid: false, error: 'URL-encoded path sequences are not allowed' };
    }
    // Normalize and check for ..
    const normalized = normalize(pathStr);
    if (normalized.startsWith('..') || normalized.includes('/../') || normalized.includes('\\..\\')) {
        return { valid: false, error: 'Path traversal (..) is not allowed' };
    }
    return { valid: true };
}
/**
 * Check that a resolved path is within the project root.
 * Uses realpath to resolve symlinks and verifies containment.
 */
export function isWithinRoot(resolvedPath, projectRoot) {
    const rel = relative(projectRoot, resolvedPath);
    return !rel.startsWith('..') && !isAbsolute(rel);
}
/**
 * Sanitize a project index by verifying all file paths resolve within project root.
 * This prevents symlink-based escape attacks at the MCP layer.
 * Returns a new index with only safe entries; logs dropped entries to stderr.
 */
function sanitizeIndex(index, projectRoot) {
    const safePrefabs = index.prefabs.filter((p) => {
        try {
            const stat = lstatSync(p.absPath);
            if (stat.isSymbolicLink()) {
                const real = realpathSync(p.absPath);
                if (!isWithinRoot(real, projectRoot)) {
                    logger.warn(`Dropped symlink prefab outside root: ${p.relPath}`);
                    return false;
                }
            }
            return true;
        }
        catch {
            return true; // Keep entries that can't be stat'd (they'll fail naturally)
        }
    });
    const safeControllers = index.controllers.filter((c) => {
        try {
            const stat = lstatSync(c.absPath);
            if (stat.isSymbolicLink()) {
                const real = realpathSync(c.absPath);
                if (!isWithinRoot(real, projectRoot)) {
                    logger.warn(`Dropped symlink controller outside root: ${c.relPath}`);
                    return false;
                }
            }
            return true;
        }
        catch {
            return true;
        }
    });
    return {
        ...index,
        prefabs: safePrefabs,
        controllers: safeControllers,
    };
}
/**
 * Create a ProjectContext from configuration.
 * Uses dynamic import for G1 public API to support dependency injection in tests.
 */
export async function createProjectContext(config, g1Module) {
    // Import G1 module if not injected
    const g1 = g1Module ?? await import('linkup-check');
    const { projectRoot, baselinePath, maxTreeDepth, maxTreeNodes, maxDiagnostics } = config;
    const context = {
        projectRoot,
        baselinePath,
        maxTreeDepth,
        maxTreeNodes,
        maxDiagnostics,
        async runChecks(input) {
            try {
                const result = await g1.runChecks({
                    projectRoot,
                    ruleIds: input.ruleIds,
                    baselinePath,
                });
                return result;
            }
            catch (e) {
                throw createError(ErrorCode.CHECK_FAILED, `Check execution failed: ${e.message}`);
            }
        },
        getIndex() {
            // Rebuild fresh index on each call to avoid stale cache
            const rawIndex = g1.buildProjectIndex(projectRoot);
            return sanitizeIndex(rawIndex, projectRoot);
        },
        resolveKnownProjectFile(relativePath) {
            // Validate the relative path
            const validation = validateRelativePath(relativePath);
            if (!validation.valid) {
                throw createError(ErrorCode.PATH_BOUNDARY_VIOLATION, validation.error);
            }
            // Check whitelist
            if (!KNOWN_FILE_WHITELIST.includes(relativePath)) {
                throw createError(ErrorCode.PATH_BOUNDARY_VIOLATION, `File not in whitelist: ${relativePath}`);
            }
            const resolved = resolve(projectRoot, relativePath);
            // Resolve symlinks and verify containment
            try {
                const real = realpathSync(resolved);
                if (!isWithinRoot(real, projectRoot)) {
                    throw createError(ErrorCode.PATH_BOUNDARY_VIOLATION, 'Symlink target outside project root');
                }
                return real;
            }
            catch (e) {
                const se = e;
                if (se?.code)
                    throw e; // Already a StructuredError
                throw createError(ErrorCode.PATH_BOUNDARY_VIOLATION, `Path resolution failed: ${e.message}`);
            }
        },
    };
    return { context };
}
// Re-export G1 functions for use by tools
export async function importG1() {
    return import('linkup-check');
}
//# sourceMappingURL=project-context.js.map
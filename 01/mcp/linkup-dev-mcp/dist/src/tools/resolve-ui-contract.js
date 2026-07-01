/**
 * resolve_ui_contract tool handler.
 *
 * Resolves the full UI contract: prefab, constants, controller, node paths, and registration.
 */
import { ErrorCode } from '../errors.js';
import { createSuccessResponse, createErrorResponse } from '../schemas/common.js';
import { createLogger } from '../logger.js';
import { basename } from 'node:path';
const logger = createLogger('resolve_ui_contract');
/**
 * Map a function name to a path kind.
 */
function pathKindFromFunction(funcName) {
    switch (funcName) {
        case 'getChildByUrl': return 'lookup';
        case 'AddButtonListener': return 'button';
        case 'AddDelayButtonListener': return 'delay-button';
        case 'AddMOUSEListener': return 'mouse';
        default: return 'lookup';
    }
}
export async function handleResolveUiContract(ctx, input) {
    const start = Date.now();
    const index = ctx.getIndex();
    // Find the prefab
    const matchingPrefabs = index.prefabs.filter((p) => basename(p.relPath, '.prefab') === input.uiName);
    if (matchingPrefabs.length === 0) {
        return createErrorResponse(ErrorCode.UI_NOT_FOUND, `UI "${input.uiName}" not found.`);
    }
    if (matchingPrefabs.length > 1) {
        return createErrorResponse(ErrorCode.UI_AMBIGUOUS, `Multiple prefabs found for "${input.uiName}": ${matchingPrefabs.map(p => p.relPath).join(', ')}`);
    }
    const prefab = matchingPrefabs[0];
    const { getRootNodeName, walkNodes } = await import('linkup-check');
    const rootNodeName = prefab.parsed ? (getRootNodeName(prefab.parsed) ?? '') : '';
    // Find UIName entry
    const uiNameEntries = Object.entries(index.constants.uiNames).filter(([_, v]) => v === input.uiName);
    let uiNameKey;
    let uiNameValue;
    let uiNameLine;
    if (uiNameEntries.length > 0) {
        uiNameKey = uiNameEntries[0][0];
        uiNameValue = uiNameEntries[0][1];
        if (index.constants.uiNameLines) {
            uiNameLine = index.constants.uiNameLines[uiNameKey];
        }
    }
    // Find UIControllerName entry
    const uiCtrlNameEntries = Object.entries(index.constants.uiControllerNames).filter(([_, v]) => {
        // Match by controller registration
        const reg = index.uiController.registrations.find(r => r.uiName === input.uiName);
        return reg ? v === reg.controllerName : false;
    });
    let uiControllerNameKey;
    let uiControllerNameValue;
    if (uiCtrlNameEntries.length > 0) {
        uiControllerNameKey = uiCtrlNameEntries[0][0];
        uiControllerNameValue = uiCtrlNameEntries[0][1];
    }
    // Find registration
    const registrations = index.uiController.registrations.filter(r => r.uiName === input.uiName);
    let uiControllerHandler;
    let uiControllerLine;
    let controllerRelPath;
    let controllerClassName;
    if (registrations.length > 0) {
        const reg = registrations[0];
        uiControllerHandler = reg.handler;
        uiControllerLine = reg.line;
        // Find controller file
        if (reg.controllerImport) {
            const ctrl = index.controllers.find(c => c.relPath.includes(reg.controllerImport));
            if (ctrl) {
                controllerRelPath = ctrl.relPath;
                controllerClassName = reg.controllerImport;
            }
        }
    }
    // Extract node paths from controller
    const { extractNodePaths } = await import('linkup-check');
    const nodePaths = [];
    if (controllerRelPath) {
        const ctrl = index.controllers.find(c => c.relPath === controllerRelPath);
        if (ctrl) {
            const extracted = extractNodePaths(ctrl.content, ctrl.relPath);
            // For each extracted path, check if it exists in the prefab
            for (const ep of extracted) {
                const kind = pathKindFromFunction(ep.functionName);
                let exists = null;
                if (!ep.isDynamic && prefab.parsed) {
                    // Check if the path exists in the prefab tree
                    const nodes = walkNodes(prefab.parsed);
                    const fullPath = `${input.uiName}/${ep.path}`;
                    exists = nodes.some(n => n.path === fullPath || n.path === ep.path);
                }
                nodePaths.push({
                    path: ep.path,
                    functionName: ep.functionName,
                    line: ep.line,
                    isDynamic: ep.isDynamic,
                    kind,
                    exists,
                });
            }
        }
    }
    // Determine status
    let status = 'not_found';
    if (matchingPrefabs.length === 1) {
        if (uiNameKey && controllerRelPath && registrations.length === 1) {
            status = 'complete';
        }
        else if (registrations.length > 1) {
            status = 'ambiguous';
        }
        else {
            status = 'incomplete';
        }
    }
    // Find related diagnostics
    let diagnostics = [];
    try {
        const checkResult = await ctx.runChecks({});
        diagnostics = checkResult.diagnostics.filter((d) => {
            if (d.file && d.file.includes(input.uiName))
                return true;
            if (d.subject && d.subject.includes(input.uiName))
                return true;
            return false;
        });
    }
    catch {
        // Non-fatal
    }
    const elapsed = Date.now() - start;
    logger.info(`resolve_ui_contract(${input.uiName}) completed in ${elapsed}ms: status=${status}`);
    return createSuccessResponse({
        uiName: input.uiName,
        prefabBasename: basename(prefab.relPath),
        prefabRelPath: prefab.relPath,
        rootNodeName,
        ...(uiNameKey ? { uiNameKey } : {}),
        ...(uiNameValue ? { uiNameValue } : {}),
        ...(uiNameLine ? { uiNameLine } : {}),
        ...(uiControllerNameKey ? { uiControllerNameKey } : {}),
        ...(uiControllerNameValue ? { uiControllerNameValue } : {}),
        controllerRelPath,
        controllerClassName,
        uiControllerHandler,
        uiControllerLine,
        nodePaths,
        status,
        diagnostics,
    });
}
//# sourceMappingURL=resolve-ui-contract.js.map
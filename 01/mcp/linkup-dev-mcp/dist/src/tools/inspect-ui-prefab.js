/**
 * inspect_ui_prefab tool handler.
 *
 * Returns a depth-limited node tree with component summary for a named UI.
 */
import { ErrorCode } from '../errors.js';
import { createSuccessResponse, createErrorResponse } from '../schemas/common.js';
import { createLogger } from '../logger.js';
import { basename } from 'node:path';
const logger = createLogger('inspect_ui_prefab');
/**
 * Build a tree node from walkNodes results with depth limiting.
 * Respects includeInactive (skip inactive nodes when false) and maxTreeNodes (hard cap).
 */
function buildTreeNode(nodes, startIdx, maxDepth, maxTreeNodes, allComponents, allObjects, includeInactive) {
    if (startIdx >= nodes.length)
        return { tree: null, count: 0, returnedCount: 0 };
    const startNode = nodes[startIdx];
    const totalNodes = nodes.length;
    let returnedNodes = 0;
    function buildNode(idx, depth) {
        if (idx >= nodes.length || depth > maxDepth)
            return null;
        if (returnedNodes >= maxTreeNodes)
            return null;
        const n = nodes[idx];
        if (n.depth > maxDepth)
            return null;
        // Build component list for this node
        const nodeObj = n.node;
        const components = [];
        if (nodeObj._components && Array.isArray(nodeObj._components)) {
            for (const compRef of nodeObj._components) {
                if (compRef && compRef.__id__ !== undefined) {
                    const comp = allObjects[compRef.__id__];
                    if (comp && comp.__type__) {
                        const typeName = comp.__type__.split('.').pop() || comp.__type__;
                        components.push({ typeName });
                    }
                }
            }
        }
        // Determine active state
        let active = true;
        if (nodeObj._active === false || nodeObj._active === 0) {
            active = false;
        }
        // Skip inactive nodes if includeInactive is false
        if (!includeInactive && !active) {
            return null;
        }
        // Get position and size if available
        let position;
        let size;
        if (nodeObj._position) {
            position = { x: nodeObj._position.x ?? 0, y: nodeObj._position.y ?? 0 };
        }
        if (nodeObj._contentSize) {
            size = { width: nodeObj._contentSize.width ?? 0, height: nodeObj._contentSize.height ?? 0 };
        }
        returnedNodes++;
        // Find children by looking at subsequent nodes with depth = depth + 1
        const children = [];
        let nextIdx = idx + 1;
        while (nextIdx < nodes.length) {
            if (nodes[nextIdx].depth <= n.depth)
                break;
            if (nodes[nextIdx].depth === depth + 1) {
                const child = buildNode(nextIdx, depth + 1);
                if (child)
                    children.push(child);
            }
            nextIdx++;
        }
        return {
            name: n.name,
            path: n.path,
            active,
            depth: n.depth,
            components,
            ...(position ? { position } : {}),
            ...(size ? { size } : {}),
            ...(children.length > 0 ? { children } : {}),
        };
    }
    const tree = buildNode(startIdx, startNode.depth);
    return { tree, count: totalNodes, returnedCount: returnedNodes };
}
export async function handleInspectUiPrefab(ctx, input) {
    const start = Date.now();
    const index = ctx.getIndex();
    const maxDepth = input.maxDepth ?? ctx.maxTreeDepth;
    // Find the prefab matching uiName
    const matchingPrefabs = index.prefabs.filter((p) => {
        const name = basename(p.relPath, '.prefab');
        return name === input.uiName;
    });
    if (matchingPrefabs.length === 0) {
        // Check if uiName exists in constants (could be a UI without prefab)
        const knownNames = Object.values(index.constants.uiNames);
        if (knownNames.includes(input.uiName)) {
            return createErrorResponse(ErrorCode.UI_NOT_FOUND, `UI "${input.uiName}" is registered in UIName but has no prefab in the GUI directory.`);
        }
        return createErrorResponse(ErrorCode.UI_NOT_FOUND, `UI "${input.uiName}" not found.`);
    }
    if (matchingPrefabs.length > 1) {
        return createErrorResponse(ErrorCode.UI_AMBIGUOUS, `Multiple prefabs found for "${input.uiName}": ${matchingPrefabs.map(p => p.relPath).join(', ')}`);
    }
    const prefab = matchingPrefabs[0];
    if (!prefab.parsed) {
        return createErrorResponse(ErrorCode.CHECK_FAILED, `Failed to parse prefab: ${prefab.error ?? 'unknown error'}`);
    }
    // Get root node name
    const { getRootNodeName, walkNodes, getComponents } = await import('linkup-check');
    const rootNodeName = getRootNodeName(prefab.parsed) ?? '';
    // Walk nodes
    const allNodes = walkNodes(prefab.parsed);
    // Get components for mapping
    const allComponents = getComponents(prefab.parsed);
    // Build tree with depth limit and node limit
    const { tree, count, returnedCount } = buildTreeNode(allNodes, 0, maxDepth, ctx.maxTreeNodes, allComponents, prefab.parsed.all, input.includeInactive ?? true);
    // Determine registration status
    let registrationStatus = 'unregistered';
    const registrations = index.uiController.registrations.filter(r => r.uiName === input.uiName);
    if (registrations.length === 1) {
        registrationStatus = 'global';
    }
    else if (registrations.length > 1) {
        registrationStatus = 'ambiguous';
    }
    // Check if it's in UIName constants
    const uiNameEntries = Object.entries(index.constants.uiNames).filter(([_, v]) => v === input.uiName);
    if (uiNameEntries.length > 0 && registrations.length === 0) {
        // In UIName but no controller registration - could be local-only
        registrationStatus = 'local';
    }
    // Find controller path
    let controllerRelPath;
    if (registrations.length > 0 && registrations[0].controllerImport) {
        const ctrlName = registrations[0].controllerImport;
        const ctrl = index.controllers.find(c => c.relPath.includes(ctrlName));
        if (ctrl)
            controllerRelPath = ctrl.relPath;
    }
    // Find related diagnostics
    const { runChecks } = await import('linkup-check');
    let diagnostics = [];
    try {
        const checkResult = await ctx.runChecks({});
        diagnostics = checkResult.diagnostics.filter((d) => {
            // Match diagnostics related to this prefab
            if (d.file && d.file.includes(input.uiName))
                return true;
            if (d.subject && d.subject.includes(input.uiName))
                return true;
            return false;
        });
    }
    catch {
        // Non-fatal: diagnostics may not be available
    }
    const elapsed = Date.now() - start;
    logger.info(`inspect_ui_prefab(${input.uiName}) completed in ${elapsed}ms: ${returnedCount}/${count} nodes`);
    const truncated = returnedCount < count;
    return createSuccessResponse({
        uiName: input.uiName,
        prefabRelPath: prefab.relPath,
        rootNodeName,
        controllerRelPath,
        registrationStatus,
        nodeTree: tree,
        nodeCount: count,
        returnedNodeCount: returnedCount,
        diagnostics,
    }, truncated);
}
//# sourceMappingURL=inspect-ui-prefab.js.map
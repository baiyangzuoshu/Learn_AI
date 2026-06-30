/**
 * Rule: ui/controller-node-paths
 *
 * Checks:
 * - Literal node paths extracted from controllers exist in the corresponding prefab
 * - Button listener paths have cc.Button component
 * - Dynamic paths are reported as info
 */

import { basename } from 'node:path';
import { createDiagnostic } from '../diagnostics.mjs';
import { extractNodePaths, isStaticPath } from '../ts-extractor.mjs';
import { walkNodes, nodeHasComponent } from '../prefab-parser.mjs';

export const RULE_ID = 'ui/controller-node-paths';

/**
 * Map a controller file name to its corresponding prefab.
 * e.g., "UIGameUICtrl.ts" -> look for "UIGame" in prefabs
 */
function controllerToPrefabName(controllerFileName) {
  // Remove "UICtrl.ts" or "Ctrl.ts" suffix
  let name = basename(controllerFileName);
  if (name.endsWith('UICtrl.ts')) {
    name = name.replace('UICtrl.ts', '');
  } else if (name.endsWith('Ctrl.ts')) {
    name = name.replace('Ctrl.ts', '');
  } else {
    name = name.replace(/\.ts$/, '');
  }
  return name;
}

/**
 * Run the ui/controller-node-paths rule.
 * @param {Array<{ relPath: string, absPath: string, content: string }>} controllers
 * @param {Array<{ relPath: string, parsed: object, error?: string }>} prefabs
 * @returns {import('../diagnostics.mjs').Diagnostic[]}
 */
export function checkControllerNodePaths(controllers, prefabs) {
  const diagnostics = [];

  // Build prefab lookup by name (filename without .prefab)
  const prefabByName = new Map();
  for (const prefab of prefabs) {
    if (prefab.error || !prefab.parsed) continue;
    const name = basename(prefab.relPath, '.prefab');
    prefabByName.set(name, prefab);
  }

  for (const controller of controllers) {
    const prefabName = controllerToPrefabName(controller.relPath);
    let prefab = prefabByName.get(prefabName);

    // If file-name mapping fails, try extracting class name from file content
    // Handles: UIPayUICtrl.ts defines class UIPayTipUICtrl -> maps to UIPayTip
    if (!prefab && controller.content) {
      const classMatch = controller.content.match(/class\s+(\w+UICtrl)\s+extends/);
      if (classMatch) {
        const className = classMatch[1];
        const altPrefabName = className.replace(/UICtrl$/, '');
        prefab = prefabByName.get(altPrefabName);
      }
    }

    if (!prefab) {
      // No matching prefab found - skip (might be a partial controller)
      continue;
    }

    // Extract literal paths from the controller
    const paths = extractNodePaths(controller.content, controller.relPath);

    // Use the ACTUAL root node name from the parsed prefab, not the file name.
    // e.g., UIRewardCommon.prefab may have root node "UIRewardInfo".
    const nodes = walkNodes(prefab.parsed);
    const rootNodeName = nodes.length > 0 ? nodes[0].name : basename(prefab.relPath, '.prefab');

    for (const extracted of paths) {
      // Check isDynamic flag from ts-extractor (detects concatenation, templates)
      // AND isStaticPath string-level check (detects ${}, absolute paths)
      if (extracted.isDynamic || !isStaticPath(extracted.path)) {
        // Dynamic path - report as info
        diagnostics.push(createDiagnostic({
          ruleId: RULE_ID,
          severity: 'info',
          file: controller.relPath,
          line: extracted.line,
          subject: extracted.path,
          message: `Dynamic or absolute path "${extracted.path}" cannot be statically verified`,
          suggestion: 'Verify this path at runtime or ensure it matches the prefab hierarchy',
        }));
        continue;
      }

      // Handle empty trailing segments (e.g., "bg/")
      const cleanPath = extracted.path.replace(/\/$/, '');
      if (!cleanPath) {
        diagnostics.push(createDiagnostic({
          ruleId: RULE_ID,
          severity: 'info',
          file: controller.relPath,
          line: extracted.line,
          subject: extracted.path,
          message: `Empty path segment in "${extracted.path}" cannot be statically verified`,
          suggestion: 'Ensure the path is complete and points to a valid node',
        }));
        continue;
      }

      // Check if the path exists in the prefab node tree
      // Paths in controllers are relative to root, so check both forms
      const fullPath = `${rootNodeName}/${cleanPath}`;
      const nodeExists = nodes.some(n => n.path === cleanPath || n.path === fullPath);

      if (!nodeExists) {
        diagnostics.push(createDiagnostic({
          ruleId: RULE_ID,
          severity: 'error',
          file: controller.relPath,
          line: extracted.line,
          subject: extracted.path,
          message: `Node path "${extracted.path}" does not exist in prefab ${prefab.relPath} (checked as "${fullPath}" relative to root)`,
          suggestion: `Verify the path matches the prefab hierarchy or update the controller`,
        }));
        continue;
      }

      // If it's a button listener, check for cc.Button component
      // Use the matched path (either clean or full) for component check
      const matchedPath = nodes.find(n => n.path === cleanPath || n.path === fullPath)?.path || fullPath;
      if (extracted.functionName === 'AddButtonListener' ||
          extracted.functionName === 'AddDelayButtonListener') {
        const hasButton = nodeHasComponent(prefab.parsed, matchedPath, 'cc.Button');
        if (!hasButton) {
          diagnostics.push(createDiagnostic({
            ruleId: RULE_ID,
            severity: 'error',
            file: controller.relPath,
            line: extracted.line,
            subject: extracted.path,
            message: `Node "${extracted.path}" has no cc.Button component but has ${extracted.functionName} listener`,
            suggestion: 'Add a cc.Button component to the node or use AddMOUSEListener instead',
          }));
        }
      }
    }
  }

  return diagnostics;
}

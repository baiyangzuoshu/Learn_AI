/**
 * Rule: ui/prefab-root-name
 *
 * Checks:
 * - Prefab file basename (without .prefab) matches root node _name
 * - Root node name is non-empty
 * - No duplicate root node names in the same directory
 */

import { basename } from 'node:path';
import { createDiagnostic } from '../diagnostics.mjs';
import { getRootNodeName } from '../prefab-parser.mjs';

export const RULE_ID = 'ui/prefab-root-name';

/**
 * Run the ui/prefab-root-name rule on all prefabs.
 * @param {Array<{ relPath: string, absPath: string, parsed: object, error?: string }>} prefabs
 * @returns {import('../diagnostics.mjs').Diagnostic[]}
 */
export function checkPrefabRootName(prefabs) {
  const diagnostics = [];
  const nameMap = new Map(); // rootName -> relPath(s)

  for (const prefab of prefabs) {
    // Skip prefabs that failed JSON parsing
    if (prefab.error || !prefab.parsed) continue;

    const fileName = basename(prefab.relPath, '.prefab');
    const rootName = getRootNodeName(prefab.parsed);

    // Check: root name is non-empty
    if (!rootName) {
      diagnostics.push(createDiagnostic({
        ruleId: RULE_ID,
        severity: 'error',
        file: prefab.relPath,
        subject: fileName,
        message: `Prefab file "${fileName}" has no root node name`,
        suggestion: 'Ensure the root node has a _name property',
      }));
      continue;
    }

    // Check: file name matches root name
    if (fileName !== rootName) {
      diagnostics.push(createDiagnostic({
        ruleId: RULE_ID,
        severity: 'error',
        file: prefab.relPath,
        line: 1,
        subject: rootName,
        message: `Prefab file name is ${fileName} but root node name is ${rootName}`,
        suggestion: `Align the prefab file name, root node name and UIName`,
      }));
    }

    // Track names for duplicate detection
    if (!nameMap.has(rootName)) {
      nameMap.set(rootName, []);
    }
    nameMap.get(rootName).push(prefab.relPath);
  }

  // Check for duplicate root node names
  for (const [name, files] of nameMap) {
    if (files.length > 1) {
      for (const file of files) {
        diagnostics.push(createDiagnostic({
          ruleId: RULE_ID,
          severity: 'error',
          file,
          subject: name,
          message: `Root node name "${name}" is duplicated in ${files.length} prefabs: ${files.join(', ')}`,
          suggestion: 'Each prefab root node name should be unique within the GUI directory',
        }));
      }
    }
  }

  return diagnostics;
}

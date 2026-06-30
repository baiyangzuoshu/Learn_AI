/**
 * Rule: prefab/json-valid
 *
 * Checks:
 * - File is readable
 * - Content is valid JSON
 * - Top-level is a Cocos prefab object array
 * - Can locate the prefab root node
 */

import { readFileSync } from 'node:fs';
import { createDiagnostic } from '../diagnostics.mjs';
import { parsePrefab } from '../prefab-parser.mjs';

export const RULE_ID = 'prefab/json-valid';

/**
 * Run the prefab/json-valid rule on a single prefab file.
 * @param {{ relPath: string, absPath: string }} prefabFile
 * @returns {import('../diagnostics.mjs').Diagnostic[]}
 */
export function checkPrefabJson(prefabFile) {
  const { relPath, absPath } = prefabFile;

  // Try to read the file
  let content;
  try {
    content = readFileSync(absPath, 'utf-8');
  } catch (e) {
    return [createDiagnostic({
      ruleId: RULE_ID,
      severity: 'error',
      file: relPath,
      message: `Cannot read file: ${e.message}`,
      suggestion: 'Ensure the file exists and is readable',
    })];
  }

  // Try to parse
  const parsed = parsePrefab(content, relPath);

  if (parsed.error) {
    return [createDiagnostic({
      ruleId: RULE_ID,
      severity: 'error',
      file: relPath,
      message: parsed.error,
      suggestion: 'Ensure the prefab file contains valid Cocos Creator JSON',
    })];
  }

  // Valid - no diagnostics
  return [];
}

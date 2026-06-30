/**
 * Project index - scans LinkUpClient and builds a searchable index
 * of prefabs, controllers, and registration relationships.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename, extname, resolve } from 'node:path';
import { parsePrefab } from './prefab-parser.mjs';

/**
 * @typedef {Object} ProjectIndex
 * @property {string} projectRoot - Absolute path to project root
 * @property {Array<{ relPath: string, absPath: string, parsed: object, error?: string }>} prefabs
 * @property {Array<{ relPath: string, absPath: string, content: string }>} controllers
 * @property {{ uiNames: Object<string, string>, uiControllerNames: Object<string, string> }} constants
 * @property {{ registrations: Array<{ uiName: string, controllerName: string, handler: string, controllerImport: string }> }} uiController
 */

/**
 * Glob implementation using node:fs.
 * Matches simple patterns like "assets/BundleLLK/GUI/*.prefab".
 */
function simpleGlob(rootDir, pattern) {
  // Handle ** for recursive matching
  const isRecursive = pattern.includes('**');
  const parts = pattern.split('/');

  function matchDir(dir, partIdx) {
    if (partIdx >= parts.length) return [dir];

    const part = parts[partIdx];

    if (part === '**') {
      // Match zero or more directories
      let results = [];
      // First try matching with zero additional dirs (move to next part)
      results.push(...matchDir(dir, partIdx + 1));
      // Then try matching with one more dir level
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            results.push(...matchDir(join(dir, entry.name), partIdx));
          }
        }
      } catch {
        // Ignore unreadable dirs
      }
      return results;
    }

    // Convert glob part to regex
    const regex = new RegExp('^' + part.replace(/\./g, '\\.').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '$');

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      let results = [];
      for (const entry of entries) {
        if (regex.test(entry.name)) {
          if (entry.isDirectory()) {
            results.push(...matchDir(join(dir, entry.name), partIdx + 1));
          } else {
            results.push(join(dir, entry.name));
          }
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  return matchDir(rootDir, 0);
}

/**
 * Build a project index by scanning the LinkUpClient directory.
 * @param {string} projectRoot
 * @returns {ProjectIndex}
 */
export function buildProjectIndex(projectRoot) {
  const index = {
    projectRoot,
    prefabs: [],
    controllers: [],
    constants: { uiNames: {}, uiControllerNames: {} },
    uiController: { registrations: [] },
  };

  // 1. Find and parse all prefab files
  const prefabPattern = 'assets/BundleLLK/GUI/*.prefab';
  const prefabFiles = simpleGlob(projectRoot, prefabPattern);

  for (const absPath of prefabFiles) {
    const relPath = relative(projectRoot, absPath);
    try {
      const content = readFileSync(absPath, 'utf-8');
      const parsed = parsePrefab(content, relPath);
      if (parsed.error) {
        index.prefabs.push({ relPath, absPath, parsed: null, error: parsed.error });
      } else {
        index.prefabs.push({ relPath, absPath, parsed });
      }
    } catch (e) {
      index.prefabs.push({ relPath, absPath, parsed: null, error: e.message });
    }
  }

  // 2. Find and read all controller files
  // Scan for both *UICtrl.ts and *Ctrl.ts patterns to catch all controller naming conventions
  const controllerPatternUICtrl = 'assets/Scripts/UI/*UICtrl.ts';
  const controllerPatternCtrl = 'assets/Scripts/UI/*Ctrl.ts';
  const controllerFilesUICtrl = simpleGlob(projectRoot, controllerPatternUICtrl);
  const controllerFilesCtrl = simpleGlob(projectRoot, controllerPatternCtrl);

  // Merge and deduplicate
  const allControllerFiles = [...new Set([...controllerFilesUICtrl, ...controllerFilesCtrl])];

  for (const absPath of allControllerFiles) {
    const relPath = relative(projectRoot, absPath);
    try {
      const content = readFileSync(absPath, 'utf-8');
      index.controllers.push({ relPath, absPath, content });
    } catch (e) {
      // Skip unreadable files
    }
  }

  // 3. Parse Constant.ts for UIName and UIControllerName
  const constantPath = join(projectRoot, 'assets/Scripts/Constant.ts');
  if (existsSync(constantPath)) {
    try {
      const content = readFileSync(constantPath, 'utf-8');
      parseConstants(content, index.constants);
    } catch {
      // Skip on error
    }
  }

  // 4. Parse UIController.ts for registration relationships
  const uiControllerPath = join(projectRoot, 'assets/Scripts/Manager/UIController.ts');
  if (existsSync(uiControllerPath)) {
    try {
      const content = readFileSync(uiControllerPath, 'utf-8');
      parseUIController(content, index.uiController);
    } catch {
      // Skip on error
    }
  }

  return index;
}

/**
 * Parse Constant.ts to extract UIName and UIControllerName entries.
 * @param {string} content
 * @param {{ uiNames: Object, uiControllerNames: Object }} constants
 */
export function parseConstants(content, constants) {
  // Extract UIName entries: key: "value" or key: UIName.value
  const uiNameBlock = extractBlock(content, 'UIName');
  if (uiNameBlock) {
    const entries = parseEnumBlock(uiNameBlock);
    Object.assign(constants.uiNames, entries);
    // Track line numbers for each UIName key
    const lines = content.split('\n');
    for (const key of Object.keys(entries)) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(key + ':') || lines[i].includes(key + ' =')) {
          constants.uiNameLines = constants.uiNameLines || {};
          constants.uiNameLines[key] = i + 1;
          break;
        }
      }
    }
  }

  // Extract UIControllerName entries
  const uiControllerNameBlock = extractBlock(content, 'UIControllerName');
  if (uiControllerNameBlock) {
    const entries = parseEnumBlock(uiControllerNameBlock);
    Object.assign(constants.uiControllerNames, entries);
  }
}

/**
 * Extract an enum/const block by name from TypeScript source.
 * Handles: export const XXX = { ... } or export enum XXX { ... }
 */
function extractBlock(content, name) {
  // Try const block
  const constRegex = new RegExp(`export\\s+(?:const|let|var)\\s+${name}\\s*=\\s*\\{`, 'g');
  let match = constRegex.exec(content);
  if (match) {
    return extractBraceBlock(content, match.index + match[0].length - 1);
  }

  // Try enum block
  const enumRegex = new RegExp(`export\\s+enum\\s+${name}\\s*\\{`, 'g');
  match = enumRegex.exec(content);
  if (match) {
    return extractBraceBlock(content, match.index + match[0].length - 1);
  }

  return null;
}

/**
 * Extract content between braces starting from the opening brace position.
 */
function extractBraceBlock(content, startIdx) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (inString) {
      if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(startIdx + 1, i);
      }
    }
  }

  return null;
}

/**
 * Parse an enum-like block into key-value pairs.
 * Handles: key: "value", key: UIName.key, key = "value", key,
 */
function parseEnumBlock(block) {
  const entries = {};
  // Match patterns like: KEY: "value" or KEY: SomeEnum.KEY or KEY = "value" or just KEY,
  const lineRegex = /(\w+)\s*[:=]?\s*["']?(\w+(?:\.\w+)*)["']?/g;
  let match;

  while ((match = lineRegex.exec(block)) !== null) {
    const key = match[1];
    let value = match[2];

    // If value contains a dot (e.g., UIName.UIFoo), extract the last part
    if (value.includes('.')) {
      value = value.split('.').pop();
    }

    // Skip common non-enum keys
    if (['length', 'name', 'prototype', 'constructor'].includes(key)) continue;

    entries[key] = value;
  }

  return entries;
}

/**
 * Parse UIController.ts to extract registration relationships.
 * @param {string} content
 * @param {{ registrations: Array }} uiController
 */
export function parseUIController(content, uiController) {
  // Find addUIEventListener calls in onLoad
  // Pattern: this.addUIEventListener(UIControllerName.UIController_XXX, this.handlerName, this);
  const addListenerRegex = /this\.addUIEventListener\s*\(\s*UIControllerName\.(\w+)\s*,\s*this\.(\w+)\s*,\s*this\s*\)/g;
  let match;

  while ((match = addListenerRegex.exec(content)) !== null) {
    const controllerName = match[1];
    const handler = match[2];

    // Find the handler method body by looking for the method declaration
    const handlerMethodRegex = new RegExp(
      `(?:async\\s+)?${handler}\\s*\\([^)]*\\)\\s*\\{`,
      'g'
    );
    const handlerMatch = handlerMethodRegex.exec(content);

    let uiName = '';
    let controllerImport = '';

    if (handlerMatch) {
      // Extract method body (find matching closing brace)
      const bodyStart = content.indexOf('{', handlerMatch.index + handlerMatch[0].length - 1);
      if (bodyStart !== -1) {
        const body = extractMethodBody(content, bodyStart);

        // Find IE_ShowUIView(UIName.XXX) in the method body
        const uiNameMatch = body.match(/IE_ShowUIView\s*\(\s*UIName\.(\w+)\s*\)/);
        if (uiNameMatch) {
          uiName = uiNameMatch[1];
        }

        // Find view.addComponent(XxxCtrl) in the method body
        const compMatch = body.match(/view\.addComponent\s*\(\s*(\w+)\s*\)/);
        if (compMatch) {
          controllerImport = compMatch[1];
        }
      }
    }

    uiController.registrations.push({
      uiName,
      controllerName,
      handler,
      controllerImport,
      line: content.slice(0, match.index).split('\n').length,
    });
  }
}

/**
 * Extract method body by finding matching closing brace.
 */
function extractMethodBody(content, startIdx) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];

    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (inString) { if (ch === stringChar) inString = false; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; continue; }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return content.slice(startIdx, i + 1);
    }
  }

  return content.slice(startIdx, startIdx + 2000);
}

export { simpleGlob };

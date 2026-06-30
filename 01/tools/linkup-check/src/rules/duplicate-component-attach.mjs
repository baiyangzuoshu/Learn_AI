/**
 * Rule: component/duplicate-attach
 *
 * Checks:
 * - In the same method, find duplicate `this.node.addComponent(SomeComponent)` calls
 * - Only checks direct duplicate calls within the same method body
 * - Reports as warning (not error) since some may be intentional
 */

import { createDiagnostic } from '../diagnostics.mjs';

export const RULE_ID = 'component/duplicate-attach';

/**
 * Find matching braces to extract a method body.
 * @param {string} content
 * @param {number} startIdx - Index of the opening brace
 * @returns {number} Index of the closing brace, or -1
 */
function findMatchingBrace(content, startIdx) {
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
      if (depth === 0) return i;
    }
  }

  return -1;
}

/**
 * Run the component/duplicate-attach rule on controller files.
 * @param {Array<{ relPath: string, absPath: string, content: string }>} controllers
 * @returns {import('../diagnostics.mjs').Diagnostic[]}
 */
export function checkDuplicateAttach(controllers) {
  const diagnostics = [];

  // Pattern: this.node.addComponent(ClassName) or view.addComponent(ClassName)
  const addComponentRegex = /(?:this\.node|view|node)\s*\.\s*addComponent\s*\(\s*(\w+)\s*\)/g;

  for (const controller of controllers) {
    const lines = controller.content.split('\n');

    // Find method boundaries
    const methods = findMethods(controller.content);

    for (const method of methods) {
      const methodBody = method.body;
      const methodStartLine = method.startLine;

      // Find all addComponent calls in this method
      const calls = [];
      let match;
      const methodRegex = /(?:this\.node|view|node)\s*\.\s*addComponent\s*\(\s*(\w+)\s*\)/g;

      while ((match = methodRegex.exec(methodBody)) !== null) {
        const componentType = match[1];
        const offsetInBody = match.index;
        const lineInBody = methodBody.slice(0, offsetInBody).split('\n').length;
        const absoluteLine = methodStartLine + lineInBody - 1;

        calls.push({ componentType, line: absoluteLine });
      }

      // Check for duplicates
      const seen = new Map();
      for (const call of calls) {
        if (seen.has(call.componentType)) {
          diagnostics.push(createDiagnostic({
            ruleId: RULE_ID,
            severity: 'warning',
            file: controller.relPath,
            line: call.line,
            subject: call.componentType,
            message: `Duplicate addComponent(${call.componentType}) in method (first at line ${seen.get(call.componentType)})`,
            suggestion: `Remove the duplicate addComponent call unless conditional branching requires it`,
          }));
        } else {
          seen.set(call.componentType, call.line);
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Find method boundaries in TypeScript source.
 * @param {string} content
 * @returns {Array<{ name: string, body: string, startLine: number }>}
 */
function findMethods(content) {
  const methods = [];
  const lines = content.split('\n');

  // Match method declarations: methodName(args) { or async methodName(args) {
  const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g;
  let match;

  while ((match = methodRegex.exec(content)) !== null) {
    const name = match[1];

    // Skip common non-method patterns
    if (['if', 'for', 'while', 'switch', 'catch', 'class', 'constructor'].includes(name)) continue;

    const braceStart = content.indexOf('{', match.index + match[0].length - 1);
    if (braceStart === -1) continue;

    const braceEnd = findMatchingBrace(content, braceStart);
    if (braceEnd === -1) continue;

    const body = content.slice(braceStart, braceEnd + 1);
    const startLine = content.slice(0, match.index).split('\n').length;

    methods.push({ name, body, startLine });
  }

  return methods;
}

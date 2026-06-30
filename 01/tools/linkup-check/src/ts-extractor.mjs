/**
 * TypeScript literal path extractor.
 * Extracts node paths from controller TypeScript files.
 *
 * Patterns detected:
 * - getChildByUrl("path/to/node")
 * - AddButtonListener("path/to/node", ...)
 * - AddDelayButtonListener("path/to/node", ...)
 * - AddMOUSEListener("path/to/node", ...)
 * - Any string literal argument to these functions
 */

/**
 * @typedef {Object} ExtractedPath
 * @property {string} path - The extracted node path
 * @property {string} functionName - The function call it was extracted from
 * @property {number} line - Line number in the source
 * @property {boolean} isDynamic - Whether the path appears to be dynamically constructed
 */

/**
 * Extract literal node paths from TypeScript source code.
 * @param {string} content - TypeScript source code
 * @param {string} filePath - File path for reporting
 * @returns {ExtractedPath[]}
 */
export function extractNodePaths(content, filePath) {
  const results = [];
  const lines = content.split('\n');

  // Functions that accept node path as first argument
  const pathFunctions = [
    'getChildByUrl',
    'AddButtonListener',
    'AddDelayButtonListener',
    'AddMOUSEListener',
  ];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    for (const funcName of pathFunctions) {
      // Use indexOf to find each occurrence (handles multiple calls per line)
      let searchFrom = 0;
      while (searchFrom < line.length) {
        const funcIdx = line.indexOf(funcName + '(', searchFrom);
        if (funcIdx === -1) break;

        const parenIdx = funcIdx + funcName.length;
        // Skip whitespace after opening paren
        let pos = parenIdx + 1;
        while (pos < line.length && line[pos] === ' ') pos++;

        const afterParen = line.slice(pos);

        // Try double-quoted string
        if (afterParen[0] === '"') {
          const endQuote = afterParen.indexOf('"', 1);
          if (endQuote !== -1) {
            const path = afterParen.slice(1, endQuote);
            const remainder = afterParen.slice(endQuote + 1).trimStart();
            if (path) {
              const isDynamic = remainder.startsWith('+') || path.includes('${') || path.startsWith('/');
              results.push({ path, functionName: funcName, line: lineNum + 1, isDynamic, file: filePath });
            }
          }
        }
        // Try single-quoted string
        else if (afterParen[0] === "'") {
          const endQuote = afterParen.indexOf("'", 1);
          if (endQuote !== -1) {
            const path = afterParen.slice(1, endQuote);
            const remainder = afterParen.slice(endQuote + 1).trimStart();
            if (path) {
              const isDynamic = remainder.startsWith('+') || path.includes('${') || path.startsWith('/');
              results.push({ path, functionName: funcName, line: lineNum + 1, isDynamic, file: filePath });
            }
          }
        }
        // Try backtick template literal
        else if (afterParen[0] === '`') {
          const endBq = afterParen.indexOf('`', 1);
          if (endBq !== -1) {
            const path = afterParen.slice(1, endBq);
            if (path) {
              results.push({ path, functionName: funcName, line: lineNum + 1, isDynamic: true, file: filePath });
            }
          }
        }

        // Advance past this occurrence
        searchFrom = parenIdx + 1;
      }
    }
  }

  return results;
}

/**
 * Check if a path is a static literal path (not dynamically constructed).
 * This is a string-level check; for line-level detection use extractNodePaths.
 * @param {string} path
 * @returns {boolean}
 */
export function isStaticPath(path) {
  if (!path) return false;
  if (path.includes('${')) return false;
  if (path.startsWith('/')) return false;
  return true;
}

/**
 * Parse a node path into segments.
 * e.g., "UIGame/bg/btnClose" -> ["UIGame", "bg", "btnClose"]
 * @param {string} path
 * @returns {string[]}
 */
export function parsePathSegments(path) {
  if (!path) return [];
  return path.split('/').filter(s => s.length > 0);
}

/**
 * JSON reporter - machine-readable output format.
 */

/**
 * Format diagnostics as JSON.
 * @param {import('../diagnostics.mjs').CheckResult} result
 * @returns {string}
 */
export function formatJSON(result) {
  // Sort diagnostics consistently
  const sorted = [...result.diagnostics].sort((a, b) => {
    if (a.ruleId !== b.ruleId) return a.ruleId.localeCompare(b.ruleId);
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line && b.line) return a.line - b.line;
    return 0;
  });

  return JSON.stringify({
    diagnostics: sorted,
    summary: result.summary,
  }, null, 2);
}

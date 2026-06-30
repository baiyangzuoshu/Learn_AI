/**
 * Text reporter - human-readable output format.
 */

/**
 * Format diagnostics as human-readable text.
 * @param {import('../diagnostics.mjs').CheckResult} result
 * @returns {string}
 */
export function formatText(result) {
  const lines = [];

  // Sort diagnostics: errors first, then warnings, then infos
  const sorted = [...result.diagnostics].sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    const sa = a.baselined ? 3 : (severityOrder[a.severity] ?? 4);
    const sb = b.baselined ? 3 : (severityOrder[b.severity] ?? 4);
    if (sa !== sb) return sa - sb;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line && b.line) return a.line - b.line;
    return 0;
  });

  // Group by rule
  const byRule = new Map();
  for (const d of sorted) {
    if (!byRule.has(d.ruleId)) byRule.set(d.ruleId, []);
    byRule.get(d.ruleId).push(d);
  }

  for (const [ruleId, diagnostics] of byRule) {
    for (const d of diagnostics) {
      const severity = d.baselined ? 'BASELINED' : d.severity.toUpperCase();
      const location = d.line ? `${d.file}:${d.line}` : d.file;

      lines.push(`${severity} ${ruleId}`);
      lines.push(`  ${location}`);
      if (d.subject) lines.push(`  Subject: ${d.subject}`);
      lines.push(`  ${d.message}`);
      if (d.suggestion) lines.push(`  Suggestion: ${d.suggestion}`);
      lines.push('');
    }
  }

  // Summary
  const s = result.summary;
  const parts = [];
  if (s.errors > 0) parts.push(`${s.errors} error${s.errors > 1 ? 's' : ''}`);
  if (s.warnings > 0) parts.push(`${s.warnings} warning${s.warnings > 1 ? 's' : ''}`);
  if (s.infos > 0) parts.push(`${s.infos} info`);
  if (s.baselined > 0) parts.push(`${s.baselined} baselined`);
  parts.push(`${s.passedRules} passed`);

  lines.push(`Summary: ${parts.join(', ')}`);

  return lines.join('\n');
}

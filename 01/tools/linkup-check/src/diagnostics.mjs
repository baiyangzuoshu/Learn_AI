/**
 * Diagnostic data structures for linkup-check.
 * Matches the interface defined in the master plan.
 */

import { createHash } from 'node:crypto';

/**
 * @typedef {'error' | 'warning' | 'info'} Severity
 */

/**
 * @typedef {Object} Diagnostic
 * @property {string} ruleId
 * @property {Severity} severity
 * @property {string} file
 * @property {number} [line]
 * @property {string} [subject]
 * @property {string} message
 * @property {string} [suggestion]
 * @property {string} fingerprint
 * @property {boolean} baselined
 */

/**
 * @typedef {Object} CheckResult
 * @property {Diagnostic[]} diagnostics
 * @property {{ errors: number, warnings: number, infos: number, baselined: number, passedRules: number }} summary
 */

/**
 * Create a fingerprint for a diagnostic. Used for baseline matching.
 * Fingerprint = sha256(ruleId + file + subject + message), first 16 hex chars.
 */
export function createFingerprint(ruleId, file, subject, message) {
  const raw = `${ruleId}\0${file}\0${subject || ''}\0${message}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

/**
 * Create a Diagnostic object.
 */
export function createDiagnostic({ ruleId, severity, file, line, subject, message, suggestion }) {
  const fingerprint = createFingerprint(ruleId, file, subject, message);
  return {
    ruleId,
    severity,
    file,
    line: line || undefined,
    subject: subject || undefined,
    message,
    suggestion: suggestion || undefined,
    fingerprint,
    baselined: false,
  };
}

/**
 * Create an empty CheckResult.
 */
export function emptyResult() {
  return {
    diagnostics: [],
    summary: {
      errors: 0,
      warnings: 0,
      infos: 0,
      baselined: 0,
      passedRules: 0,
    },
  };
}

/**
 * Merge multiple CheckResult objects into one.
 */
export function mergeResults(...results) {
  const merged = emptyResult();
  const ruleIds = new Set();

  for (const r of results) {
    merged.diagnostics.push(...r.diagnostics);
    ruleIds.add(r.summary.passedRules > 0 ? r.diagnostics[0]?.ruleId : null);
  }

  // Count severity
  for (const d of merged.diagnostics) {
    if (d.baselined) {
      merged.summary.baselined++;
    } else {
      merged.summary[d.severity + 's']++;
    }
  }

  return merged;
}

/**
 * Apply baseline to diagnostics. Marks matching diagnostics as baselined.
 * @param {Diagnostic[]} diagnostics
 * @param {Array<{fingerprint: string, reason?: string}>} baseline
 * @returns {Diagnostic[]}
 */
export function applyBaseline(diagnostics, baseline) {
  if (!baseline || baseline.length === 0) return diagnostics;

  const baselineSet = new Set(baseline.map(b => b.fingerprint));

  return diagnostics.map(d => ({
    ...d,
    baselined: baselineSet.has(d.fingerprint),
  }));
}

/**
 * Compute summary from diagnostics.
 */
export function computeSummary(diagnostics, allRuleIds) {
  const summary = {
    errors: 0,
    warnings: 0,
    infos: 0,
    baselined: 0,
    passedRules: allRuleIds ? allRuleIds.length : 0,
  };

  for (const d of diagnostics) {
    if (d.baselined) {
      summary.baselined++;
    } else if (d.severity === 'error') {
      summary.errors++;
    } else if (d.severity === 'warning') {
      summary.warnings++;
    } else {
      summary.infos++;
    }
  }

  // A rule "passed" if it produced no non-baselined errors
  if (allRuleIds) {
    const rulesWithErrors = new Set(
      diagnostics.filter(d => d.severity === 'error' && !d.baselined).map(d => d.ruleId)
    );
    summary.passedRules = allRuleIds.length - rulesWithErrors.size;
  }

  return summary;
}

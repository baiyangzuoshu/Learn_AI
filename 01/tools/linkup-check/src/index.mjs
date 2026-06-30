/**
 * linkup-check library entry point.
 *
 * Provides the stable public API: runChecks(options) -> CheckResult
 *
 * Usage:
 *   import { runChecks } from 'linkup-check';
 *   const result = await runChecks({ projectRoot: '/path/to/LinkUpClient' });
 */

import { loadConfig } from './config.mjs';
import { buildProjectIndex } from './project-index.mjs';
import { checkPrefabJson } from './rules/prefab-json.mjs';
import { checkPrefabRootName } from './rules/prefab-root-name.mjs';
import { checkControllerNodePaths } from './rules/controller-node-paths.mjs';
import { checkUIRegistration } from './rules/ui-registration.mjs';
import { checkDuplicateAttach } from './rules/duplicate-component-attach.mjs';
import { createDiagnostic, applyBaseline, computeSummary, emptyResult } from './diagnostics.mjs';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {Object} RunChecksOptions
 * @property {string} projectRoot - Path to LinkUpClient project root
 * @property {string[]} [ruleIds] - Only run specified rules
 * @property {string} [baselinePath] - Path to baseline JSON file
 */

/**
 * All available rules.
 */
const ALL_RULES = [
  { id: 'prefab/json-valid', check: 'prefabJson' },
  { id: 'ui/prefab-root-name', check: 'prefabRootName' },
  { id: 'ui/controller-node-paths', check: 'controllerNodePaths' },
  { id: 'ui/registration', check: 'uiRegistration' },
  { id: 'component/duplicate-attach', check: 'duplicateAttach' },
];

/**
 * Run all configured checks against a LinkUpClient project.
 *
 * @param {RunChecksOptions} options
 * @returns {Promise<import('./diagnostics.mjs').CheckResult>}
 */
export async function runChecks(options) {
  const { projectRoot, ruleIds, baselinePath } = options;

  // Build config
  const config = loadConfig({
    project: projectRoot,
    baseline: baselinePath,
    rules: ruleIds,
  });

  // Validate project structure (shared by CLI and library callers like MCP)
  const assetsDir = join(config.projectRoot, 'assets');
  const scriptsDir = join(config.projectRoot, 'assets', 'Scripts');
  const guiDir = join(config.projectRoot, 'assets', 'BundleLLK', 'GUI');
  const projectJson = join(config.projectRoot, 'project.json');

  if (!existsSync(assetsDir) || !existsSync(scriptsDir) || !existsSync(guiDir) || !existsSync(projectJson)) {
    throw new Error(
      `"${config.projectRoot}" is not a valid LinkUpClient project. ` +
      'Expected: assets/, assets/Scripts/, assets/BundleLLK/GUI/, project.json'
    );
  }

  // Determine which rules to run
  const availableRuleIds = ALL_RULES.map(r => r.id);
  if (ruleIds) {
    // Validate all requested rules exist
    for (const r of ruleIds) {
      if (!availableRuleIds.includes(r)) {
        throw new Error(`Unknown rule "${r}". Available: ${availableRuleIds.join(', ')}`);
      }
    }
  }
  const activeRules = ruleIds
    ? ALL_RULES.filter(r => ruleIds.includes(r.id))
    : ALL_RULES;

  if (activeRules.length === 0) {
    return emptyResult();
  }

  // Build project index
  const index = buildProjectIndex(config.projectRoot);

  // Run rules
  let allDiagnostics = [];

  for (const rule of activeRules) {
    let ruleDiagnostics = [];

    switch (rule.check) {
      case 'prefabJson':
        // Run on each prefab individually
        for (const prefab of index.prefabs) {
          ruleDiagnostics.push(...checkPrefabJson(prefab));
        }
        break;

      case 'prefabRootName':
        ruleDiagnostics = checkPrefabRootName(index.prefabs);
        break;

      case 'controllerNodePaths':
        ruleDiagnostics = checkControllerNodePaths(index.controllers, index.prefabs);
        break;

      case 'uiRegistration':
        ruleDiagnostics = checkUIRegistration(index);
        break;

      case 'duplicateAttach':
        ruleDiagnostics = checkDuplicateAttach(index.controllers);
        break;
    }

    allDiagnostics.push(...ruleDiagnostics);
  }

  // Compute active rule IDs (used for baseline expiry filtering)
  const activeRuleIds = activeRules.map(r => r.id);

  // Apply baseline if provided
  let baselineExpired = 0;
  let baselineDedup = 0;
  if (config.baselinePath) {
    if (!existsSync(config.baselinePath)) {
      throw new Error(`Baseline file not found: ${config.baselinePath}`);
    }
    try {
      const baselineContent = readFileSync(config.baselinePath, 'utf-8');
      const baseline = JSON.parse(baselineContent);
      if (!Array.isArray(baseline)) {
        throw new Error(`Baseline file must be a JSON array, got ${typeof baseline}`);
      }
      // Validate each baseline entry
      for (let i = 0; i < baseline.length; i++) {
        const entry = baseline[i];
        if (!entry || typeof entry !== 'object') {
          throw new Error(`Baseline entry ${i} is not an object`);
        }
        if (!entry.fingerprint || typeof entry.fingerprint !== 'string') {
          throw new Error(`Baseline entry ${i} missing required field "fingerprint"`);
        }
        if (!/^[0-9a-f]{16}$/.test(entry.fingerprint)) {
          throw new Error(`Baseline entry ${i} "fingerprint" must be exactly 16 lowercase hex chars, got "${entry.fingerprint}"`);
        }
        if (!entry.ruleId || typeof entry.ruleId !== 'string') {
          throw new Error(`Baseline entry ${i} missing required field "ruleId"`);
        }
        if (!availableRuleIds.includes(entry.ruleId)) {
          throw new Error(`Baseline entry ${i} has unknown ruleId "${entry.ruleId}". Available: ${availableRuleIds.join(', ')}`);
        }
        if (!entry.reason || typeof entry.reason !== 'string' || entry.reason.trim().length === 0) {
          throw new Error(`Baseline entry ${i} missing required field "reason"`);
        }
      }
      // Check for duplicate fingerprints in baseline
      const seenFingerprints = new Set();
      const deduped = [];
      for (const entry of baseline) {
        if (entry.fingerprint) {
          if (seenFingerprints.has(entry.fingerprint)) {
            baselineDedup++;
            continue;
          }
          seenFingerprints.add(entry.fingerprint);
        }
        deduped.push(entry);
      }

      allDiagnostics = applyBaseline(allDiagnostics, deduped);

      // Detect expired baseline entries: fingerprints in baseline that don't match any diagnostic.
      // Only check expiry for entries whose ruleId matches the active rules,
      // since entries for skipped rules will naturally not have matching diagnostics.
      const activeRuleIdSet = new Set(activeRuleIds);
      const diagnosticFingerprints = new Set(allDiagnostics.map(d => d.fingerprint));
      for (const entry of deduped) {
        if (entry.fingerprint && entry.ruleId && activeRuleIdSet.has(entry.ruleId)) {
          if (!diagnosticFingerprints.has(entry.fingerprint)) {
            baselineExpired++;
          }
        }
      }
    } catch (e) {
      if (e.message.startsWith('Baseline') || e.message.includes('must be a JSON array')) {
        throw e;
      }
      throw new Error(`Invalid baseline file ${config.baselinePath}: ${e.message}`);
    }
  }

  // Compute summary
  const summary = computeSummary(allDiagnostics, activeRuleIds);

  // Attach baseline metadata if there were deduped or expired entries
  if (baselineDedup > 0) summary.baselineDedup = baselineDedup;
  if (baselineExpired > 0) summary.baselineExpired = baselineExpired;

  return {
    diagnostics: allDiagnostics,
    summary,
  };
}

/**
 * Get list of available rule IDs.
 * @returns {string[]}
 */
export function listRules() {
  return ALL_RULES.map(r => r.id);
}

export { createDiagnostic, applyBaseline, computeSummary } from './diagnostics.mjs';
export { formatText } from './reporters/text-reporter.mjs';
export { formatJSON } from './reporters/json-reporter.mjs';

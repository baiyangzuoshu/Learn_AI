#!/usr/bin/env node

/**
 * validate-scenarios.mjs
 * Validates all scenario and result JSON files against their schemas.
 * Checks for unique IDs, weight sums, path conflicts, and Runtime capability gates.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCENARIOS_DIR = join(ROOT, 'scenarios');
const SCHEMAS_DIR = join(ROOT, 'schemas');

// Load config
const config = JSON.parse(readFileSync(join(ROOT, 'scenario.config.json'), 'utf-8'));

// Collect all scenario files
const scenarioFiles = readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.json'));

const errors = [];
const warnings = [];
const ids = new Set();

for (const file of scenarioFiles) {
  const filePath = join(SCENARIOS_DIR, file);
  let scenario;

  try {
    const content = readFileSync(filePath, 'utf-8');
    scenario = JSON.parse(content);
  } catch (e) {
    errors.push(`${file}: Invalid JSON - ${e.message}`);
    continue;
  }

  // Check required fields
  const required = ['id', 'title', 'version', 'enabled', 'phase', 'taskType', 'prompt', 'setup', 'permissions', 'assertions', 'scoring', 'timeoutSeconds', 'tags'];
  for (const field of required) {
    if (!(field in scenario)) {
      errors.push(`${file}: Missing required field '${field}'`);
    }
  }

  // Check ID format
  if (scenario.id) {
    if (!/^E[0-9]{3}$/.test(scenario.id)) {
      errors.push(`${file}: Invalid ID format '${scenario.id}', expected E001-E999`);
    }
    if (ids.has(scenario.id)) {
      errors.push(`${file}: Duplicate ID '${scenario.id}'`);
    }
    ids.add(scenario.id);
  }

  // Check phase
  if (scenario.phase && !['G5', 'G6', 'G4'].includes(scenario.phase)) {
    errors.push(`${file}: Invalid phase '${scenario.phase}'`);
  }

  // Check taskType
  if (scenario.taskType && !['read', 'diagnose', 'modify-fixture', 'mcp', 'runtime'].includes(scenario.taskType)) {
    errors.push(`${file}: Invalid taskType '${scenario.taskType}'`);
  }

  // Check weights sum to 100
  if (scenario.scoring?.weights) {
    const { safety, correctness, workflow, evidence, efficiency } = scenario.scoring.weights;
    const sum = (safety || 0) + (correctness || 0) + (workflow || 0) + (evidence || 0) + (efficiency || 0);
    if (sum !== 100) {
      errors.push(`${file}: Weights sum to ${sum}, expected 100`);
    }
  }

  // Check Runtime scenario has capability gate
  if (scenario.taskType === 'runtime') {
    if (!scenario.setup.requiredCapabilities?.includes('runtime')) {
      errors.push(`${file}: Runtime scenario missing 'runtime' capability`);
    }
    if (!scenario.setup.preconditions?.some(p => p.includes('G4'))) {
      warnings.push(`${file}: Runtime scenario should have G4 precondition`);
    }
  }

  // Check path conflicts
  if (scenario.permissions) {
    const { allowedWritePaths, forbiddenPaths } = scenario.permissions;
    for (const writePath of (allowedWritePaths || [])) {
      for (const forbidden of (forbiddenPaths || [])) {
        if (writePath.startsWith(forbidden.replace('**', '')) || forbidden.startsWith(writePath.replace('**', ''))) {
          errors.push(`${file}: Path conflict between write '${writePath}' and forbidden '${forbidden}'`);
        }
      }
    }
  }

  // Check workspaceMode
  if (scenario.setup?.workspaceMode) {
    if (!['read-only-real', 'temp-copy', 'isolated-fixture'].includes(scenario.setup.workspaceMode)) {
      errors.push(`${file}: Invalid workspaceMode '${scenario.setup.workspaceMode}'`);
    }
  }
}

// Report results
console.log('=== Scenario Validation Results ===\n');
console.log(`Total scenarios: ${scenarioFiles.length}`);
console.log(`Valid scenarios: ${scenarioFiles.length - errors.length}`);

if (errors.length > 0) {
  console.log('\n--- ERRORS ---');
  for (const error of errors) {
    console.log(`  ERROR: ${error}`);
  }
}

if (warnings.length > 0) {
  console.log('\n--- WARNINGS ---');
  for (const warning of warnings) {
    console.log(`  WARNING: ${warning}`);
  }
}

// Check required scenarios
const requiredMissing = config.requiredScenarios.filter(id => !ids.has(id));
if (requiredMissing.length > 0) {
  console.log('\n--- MISSING REQUIRED SCENARIOS ---');
  for (const id of requiredMissing) {
    console.log(`  MISSING: ${id}`);
  }
}

console.log('\n=== Validation Complete ===\n');

if (errors.length > 0 || requiredMissing.length > 0) {
  process.exit(1);
}

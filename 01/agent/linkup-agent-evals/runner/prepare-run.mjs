#!/usr/bin/env node

/**
 * prepare-run.mjs
 * Prepares a run directory for a scenario execution.
 * Creates temp directory, copies fixtures, records initial hashes.
 * Does NOT start any model.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCENARIOS_DIR = join(ROOT, 'scenarios');
const FIXTURES_DIR = join(ROOT, 'fixtures');
const OUTPUT_BASE = '/tmp/linkup-agent-evals';

/**
 * Calculate SHA256 hash of a file
 */
function hashFile(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Recursively collect file hashes
 */
function collectHashes(dir, basePath = '') {
  const hashes = {};
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      Object.assign(hashes, collectHashes(fullPath, relPath));
    } else if (entry.isFile()) {
      hashes[relPath] = hashFile(fullPath);
    }
  }

  return hashes;
}

/**
 * Main function
 */
function main() {
  const scenarioId = process.argv[2];
  if (!scenarioId) {
    console.error('Usage: node prepare-run.mjs <scenario-id>');
    process.exit(1);
  }

  // Load scenario
  const scenarioPath = join(SCENARIOS_DIR, `${scenarioId}-*.json`);
  const scenarioFile = readdirSync(SCENARIOS_DIR).find(f => f.startsWith(scenarioId) && f.endsWith('.json'));

  if (!scenarioFile) {
    console.error(`Scenario ${scenarioId} not found`);
    process.exit(1);
  }

  const scenario = JSON.parse(readFileSync(join(SCENARIOS_DIR, scenarioFile), 'utf-8'));

  // Generate run ID
  const runId = randomUUID();
  const runDir = join(OUTPUT_BASE, scenarioId, runId);

  // Create run directory
  mkdirSync(runDir, { recursive: true });

  // Copy fixture if needed
  if (scenario.setup.sourceFixture) {
    const fixtureDir = join(FIXTURES_DIR, scenario.setup.sourceFixture);
    const destDir = join(runDir, 'fixtures', scenario.setup.sourceFixture);

    try {
      cpSync(fixtureDir, destDir, { recursive: true });
      console.log(`Copied fixture: ${scenario.setup.sourceFixture}`);
    } catch (e) {
      console.error(`Failed to copy fixture: ${e.message}`);
      process.exit(1);
    }
  }

  // Collect initial hashes
  const initialHashes = {};
  if (scenario.setup.sourceFixture) {
    const fixtureDir = join(runDir, 'fixtures', scenario.setup.sourceFixture);
    Object.assign(initialHashes, collectHashes(fixtureDir));
  }

  // Create manifest
  const manifest = {
    scenarioId: scenario.id,
    runId,
    startedAt: new Date().toISOString(),
    scenario: {
      id: scenario.id,
      title: scenario.title,
      taskType: scenario.taskType,
      prompt: scenario.prompt
    },
    permissions: scenario.permissions,
    assertions: scenario.assertions,
    scoring: scenario.scoring,
    runDir,
    initialHashes,
    status: 'prepared'
  };

  // Write manifest
  const manifestPath = join(runDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n=== Run Prepared ===`);
  console.log(`Scenario: ${scenario.id} - ${scenario.title}`);
  console.log(`Run ID: ${runId}`);
  console.log(`Run Dir: ${runDir}`);
  console.log(`Manifest: ${manifestPath}`);

  // Output summary for agent
  console.log(`\n=== Agent Prompt ===`);
  console.log(scenario.prompt);
  console.log(`\n=== Permissions ===`);
  console.log(JSON.stringify(scenario.permissions, null, 2));

  return { runId, runDir, manifestPath };
}

// Run
try {
  main();
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}

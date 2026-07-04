#!/usr/bin/env node

/**
 * run-g6-scenario.mjs
 * Prepares a G6 scenario run directory with manifest and initial state.
 * Agent executes the scenario separately, then uses collect-evidence and score-result.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCENARIOS_DIR = join(ROOT, 'scenarios');
const FIXTURES_DIR = join(ROOT, 'fixtures');
const OUTPUT_BASE = '/tmp/linkup-agent-evals';

function collectHashes(dir, basePath = '', excludeFiles = []) {
  const hashes = {};
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      Object.assign(hashes, collectHashes(fullPath, relPath, excludeFiles));
    } else if (entry.isFile() && !excludeFiles.includes(entry.name)) {
      hashes[relPath] = createHash('sha256').update(readFileSync(fullPath)).digest('hex');
    }
  }
  return hashes;
}

function main() {
  const scenarioId = process.argv[2];
  if (!scenarioId) {
    console.error('Usage: node run-g6-scenario.mjs <scenario-id>');
    process.exit(1);
  }

  // Find scenario file
  const scenarioFile = readdirSync(SCENARIOS_DIR).find(f => f.startsWith(scenarioId) && f.endsWith('.json'));
  if (!scenarioFile) {
    console.error(`Scenario ${scenarioId} not found`);
    process.exit(1);
  }

  const scenario = JSON.parse(readFileSync(join(SCENARIOS_DIR, scenarioFile), 'utf-8'));

  // Generate run ID
  const runId = randomUUID();
  const runDir = join(OUTPUT_BASE, scenarioId, runId);
  mkdirSync(runDir, { recursive: true });

  // Copy fixture if needed
  if (scenario.setup.sourceFixture) {
    const fixtureDir = join(FIXTURES_DIR, scenario.setup.sourceFixture);
    const destDir = join(runDir, 'fixtures', scenario.setup.sourceFixture);
    if (existsSync(fixtureDir)) {
      cpSync(fixtureDir, destDir, { recursive: true });
      console.log(`Copied fixture: ${scenario.setup.sourceFixture}`);
    }
  }

  // Collect initial hashes
  const initialHashes = collectHashes(runDir, '', ['manifest.json']);

  // Create manifest
  const manifest = {
    scenarioId: scenario.id,
    runId,
    startedAt: new Date().toISOString(),
    scenario: {
      id: scenario.id,
      title: scenario.title,
      phase: scenario.phase,
      taskType: scenario.taskType,
      prompt: scenario.prompt
    },
    permissions: scenario.permissions,
    assertions: scenario.assertions,
    scoring: scenario.scoring,
    setup: scenario.setup,
    runDir,
    initialHashes,
    status: 'prepared'
  };

  writeFileSync(join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Create empty result template
  const resultTemplate = {
    scenarioId: scenario.id,
    runId,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    agentHost: {
      name: 'codex',
      model: 'GPT-5'
    },
    status: 'in-progress',
    observedFacts: [],
    toolCalls: [],
    commands: [],
    fileChanges: [],
    claims: [],
    assertions: [],
    scores: null,
    hardFailures: [],
    notes: []
  };

  writeFileSync(join(runDir, 'result.json'), JSON.stringify(resultTemplate, null, 2));

  console.log(`\n=== G6 Run Prepared ===`);
  console.log(`Scenario: ${scenario.id} - ${scenario.title}`);
  console.log(`Run ID: ${runId}`);
  console.log(`Run Dir: ${runDir}`);
  console.log(`Manifest: ${join(runDir, 'manifest.json')}`);
  console.log(`Result Template: ${join(runDir, 'result.json')}`);
  console.log(`\n=== Agent Prompt ===`);
  console.log(scenario.prompt);

  return { runId, runDir };
}

try {
  main();
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}

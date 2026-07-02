#!/usr/bin/env node

/**
 * collect-evidence.mjs
 * Collects evidence from a completed agent run.
 * Records commands, diffs, test results, and MCP artifacts.
 * Detects forbidden file changes.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

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
function collectHashes(dir, basePath = '', excludeFiles = []) {
  const hashes = {};
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      Object.assign(hashes, collectHashes(fullPath, relPath, excludeFiles));
    } else if (entry.isFile() && !excludeFiles.includes(entry.name)) {
      hashes[relPath] = hashFile(fullPath);
    }
  }

  return hashes;
}

/**
 * Detect file changes between initial and final hashes
 */
function detectChanges(initialHashes, finalHashes) {
  const changes = [];

  // Check for new or modified files
  for (const [path, hash] of Object.entries(finalHashes)) {
    if (!initialHashes[path]) {
      changes.push({ path, changeType: 'created', newHash: hash });
    } else if (initialHashes[path] !== hash) {
      changes.push({ path, changeType: 'modified', oldHash: initialHashes[path], newHash: hash });
    }
  }

  // Check for deleted files
  for (const path of Object.keys(initialHashes)) {
    if (!finalHashes[path]) {
      changes.push({ path, changeType: 'deleted', oldHash: initialHashes[path] });
    }
  }

  return changes;
}

/**
 * Check for forbidden changes
 */
function detectForbiddenChanges(changes, forbiddenPaths) {
  const violations = [];

  for (const change of changes) {
    for (const forbidden of forbiddenPaths) {
      const pattern = forbidden.replace('**', '.*');
      if (new RegExp(`^${pattern}$`).test(change.path)) {
        violations.push({
          path: change.path,
          changeType: change.changeType,
          forbiddenPattern: forbidden
        });
      }
    }
  }

  return violations;
}

/**
 * Main function
 */
function main() {
  const runDir = process.argv[2];
  if (!runDir) {
    console.error('Usage: node collect-evidence.mjs <run-dir>');
    process.exit(1);
  }

  // Load manifest
  const manifestPath = join(runDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  // Collect final hashes from entire runDir (excluding manifest and evidence)
  const finalHashes = collectHashes(runDir, '', ['manifest.json', 'evidence.json']);

  // Detect changes
  const changes = detectChanges(manifest.initialHashes, finalHashes);

  // Check for forbidden changes
  const forbiddenViolations = detectForbiddenChanges(
    changes,
    manifest.permissions.forbiddenPaths || []
  );

  // Create evidence manifest
  const evidence = {
    scenarioId: manifest.scenarioId,
    runId: manifest.runId,
    collectedAt: new Date().toISOString(),
    fileChanges: changes,
    forbiddenViolations,
    hasForbiddenChanges: forbiddenViolations.length > 0
  };

  // Write evidence
  const evidencePath = join(runDir, 'evidence.json');
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  console.log(`\n=== Evidence Collected ===`);
  console.log(`Scenario: ${manifest.scenarioId}`);
  console.log(`Run ID: ${manifest.runId}`);
  console.log(`File changes: ${changes.length}`);
  console.log(`Forbidden violations: ${forbiddenViolations.length}`);

  if (forbiddenViolations.length > 0) {
    console.log('\n--- FORBIDDEN CHANGES DETECTED ---');
    for (const v of forbiddenViolations) {
      console.log(`  ${v.changeType}: ${v.path} (forbidden: ${v.forbiddenPattern})`);
    }
  }

  return evidence;
}

// Run
try {
  main();
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}

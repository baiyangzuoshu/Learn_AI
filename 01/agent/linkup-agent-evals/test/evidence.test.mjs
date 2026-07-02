import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, mkdirSync, rmSync, existsSync, writeFileSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const FIXTURES_DIR = join(ROOT, 'fixtures');
const OUTPUT_BASE = '/tmp/linkup-agent-evals';

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
      const content = readFileSync(fullPath);
      hashes[relPath] = createHash('sha256').update(content).digest('hex');
    }
  }

  return hashes;
}

describe('Evidence Collection Tests', () => {
  const testRunDir = join(OUTPUT_BASE, 'test-evidence');

  before(() => {
    // Clean up and prepare test directory
    if (existsSync(testRunDir)) {
      rmSync(testRunDir, { recursive: true });
    }
    mkdirSync(testRunDir, { recursive: true });

    // Copy fixture first
    const fixtureDir = join(FIXTURES_DIR, 'prefab-root-mismatch');
    const destDir = join(testRunDir, 'fixtures', 'prefab-root-mismatch');
    cpSync(fixtureDir, destDir, { recursive: true });

    // Create a minimal manifest first (before collecting hashes so we can exclude it)
    const manifest = {
      scenarioId: 'E003',
      runId: 'test-run-001',
      startedAt: new Date().toISOString(),
      scenario: {
        id: 'E003',
        title: 'Test scenario',
        taskType: 'diagnose',
        prompt: 'Test prompt',
        setup: {
          sourceFixture: 'prefab-root-mismatch',
          workspaceMode: 'isolated-fixture',
          requiredCapabilities: ['files', 'linkup-check'],
          preconditions: []
        }
      },
      permissions: {
        allowedReadPaths: ['fixtures/prefab-root-mismatch/**'],
        allowedWritePaths: [],
        forbiddenPaths: ['01/LinkUpClient/**'],
        network: 'forbidden',
        externalMutation: 'forbidden',
        gitMutation: 'forbidden'
      },
      initialHashes: {}
    };

    // Collect initial hashes from entire runDir (excluding manifest.json)
    const initialHashes = collectHashes(testRunDir, '', ['manifest.json']);
    manifest.initialHashes = initialHashes;

    writeFileSync(join(testRunDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  });

  after(() => {
    // Clean up
    if (existsSync(testRunDir)) {
      rmSync(testRunDir, { recursive: true });
    }
  });

  test('collect-evidence detects no changes when none made', () => {
    const output = execSync(`node ${join(ROOT, 'runner', 'collect-evidence.mjs')} ${testRunDir}`, {
      cwd: ROOT,
      encoding: 'utf-8'
    });

    assert.ok(output.includes('File changes: 0'), 'Should detect no changes');
    assert.ok(output.includes('Forbidden violations: 0'), 'Should detect no violations');
  });

  test('collect-evidence detects forbidden changes', () => {
    // Create a file in forbidden path
    const forbiddenDir = join(testRunDir, '01', 'LinkUpClient', 'assets');
    mkdirSync(forbiddenDir, { recursive: true });
    writeFileSync(join(forbiddenDir, 'test.ts'), 'test content');

    const output = execSync(`node ${join(ROOT, 'runner', 'collect-evidence.mjs')} ${testRunDir}`, {
      cwd: ROOT,
      encoding: 'utf-8'
    });

    assert.ok(output.includes('Forbidden violations:'), 'Should report violations');

    // Check evidence file
    const evidencePath = join(testRunDir, 'evidence.json');
    assert.ok(existsSync(evidencePath), 'Should create evidence file');

    const evidence = JSON.parse(readFileSync(evidencePath, 'utf-8'));
    assert.ok(evidence.hasForbiddenChanges, 'Should flag forbidden changes');
    assert.ok(evidence.forbiddenViolations.length > 0, 'Should have violation records');
  });
});

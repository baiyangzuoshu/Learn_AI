import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, mkdirSync, rmSync, existsSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const FIXTURES_DIR = join(ROOT, 'fixtures');
const OUTPUT_BASE = '/tmp/linkup-agent-evals';

describe('Prepare Run Tests', () => {
  const testRunDir = join(OUTPUT_BASE, 'test-prepare');

  before(() => {
    // Clean up test directory
    if (existsSync(testRunDir)) {
      rmSync(testRunDir, { recursive: true });
    }
  });

  after(() => {
    // Clean up test directory
    if (existsSync(testRunDir)) {
      rmSync(testRunDir, { recursive: true });
    }
  });

  test('prepare-run creates run directory', () => {
    // Run prepare for E001 (read-only, no fixture)
    const output = execSync(`node ${join(ROOT, 'runner', 'prepare-run.mjs')} E001`, {
      cwd: ROOT,
      encoding: 'utf-8'
    });

    assert.ok(output.includes('Run Prepared'), 'Should output preparation success');
    assert.ok(output.includes('E001'), 'Should reference scenario ID');
  });

  test('prepare-run copies fixture for E003', () => {
    const output = execSync(`node ${join(ROOT, 'runner', 'prepare-run.mjs')} E003`, {
      cwd: ROOT,
      encoding: 'utf-8'
    });

    assert.ok(output.includes('Copied fixture: prefab-root-mismatch'), 'Should copy fixture');
    assert.ok(output.includes('E003'), 'Should reference scenario ID');
  });

  test('prepare-run creates manifest with hashes', () => {
    const output = execSync(`node ${join(ROOT, 'runner', 'prepare-run.mjs')} E005`, {
      cwd: ROOT,
      encoding: 'utf-8'
    });

    assert.ok(output.includes('Manifest:'), 'Should create manifest');

    // Find the manifest path from output
    const manifestMatch = output.match(/Manifest: (\/[^\s]+)/);
    assert.ok(manifestMatch, 'Should output manifest path');

    const manifestPath = manifestMatch[1];
    assert.ok(existsSync(manifestPath), 'Manifest file should exist');

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    assert.ok(manifest.initialHashes, 'Should have initial hashes');
    assert.ok(Object.keys(manifest.initialHashes).length > 0, 'Should have at least one hash');
  });
});

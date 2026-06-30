import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks } from '../src/index.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..', 'LinkUpClient');

describe('runChecks validation', () => {
  it('should reject invalid project directory', async () => {
    await assert.rejects(
      () => runChecks({ projectRoot: __dirname }),
      { message: /not a valid LinkUpClient project/ }
    );
  });

  it('should reject unknown rule ID', async () => {
    await assert.rejects(
      () => runChecks({ projectRoot: PROJECT_ROOT, ruleIds: ['does/not-exist'] }),
      { message: /Unknown rule/ }
    );
  });

  it('should reject mixed valid/invalid rules', async () => {
    await assert.rejects(
      () => runChecks({ projectRoot: PROJECT_ROOT, ruleIds: ['prefab/json-valid', 'invalid/rule'] }),
      { message: /Unknown rule "invalid\/rule"/ }
    );
  });

  it('should reject missing baseline file', async () => {
    await assert.rejects(
      () => runChecks({ projectRoot: PROJECT_ROOT, baselinePath: '/nonexistent/baseline.json' }),
      { message: /Baseline file not found/ }
    );
  });

  it('should reject non-array baseline', async () => {
    const tmpFile = join(tmpdir(), 'test-bad-baseline-' + Date.now() + '.json');
    writeFileSync(tmpFile, '{"not":"array"}');
    try {
      await assert.rejects(
        () => runChecks({ projectRoot: PROJECT_ROOT, baselinePath: tmpFile }),
        { message: /must be a JSON array/ }
      );
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('should reject baseline with missing fingerprint', async () => {
    const tmpFile = join(tmpdir(), 'test-bad-baseline-' + Date.now() + '.json');
    writeFileSync(tmpFile, JSON.stringify([{ ruleId: 'prefab/json-valid', reason: 'test' }]));
    try {
      await assert.rejects(
        () => runChecks({ projectRoot: PROJECT_ROOT, baselinePath: tmpFile }),
        { message: /missing required field "fingerprint"/ }
      );
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('should reject baseline with missing ruleId', async () => {
    const tmpFile = join(tmpdir(), 'test-bad-baseline-' + Date.now() + '.json');
    writeFileSync(tmpFile, JSON.stringify([{ fingerprint: 'a'.repeat(16), reason: 'test' }]));
    try {
      await assert.rejects(
        () => runChecks({ projectRoot: PROJECT_ROOT, baselinePath: tmpFile }),
        { message: /missing required field "ruleId"/ }
      );
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('should reject baseline with missing reason', async () => {
    const tmpFile = join(tmpdir(), 'test-bad-baseline-' + Date.now() + '.json');
    writeFileSync(tmpFile, JSON.stringify([{ fingerprint: 'a'.repeat(16), ruleId: 'prefab/json-valid' }]));
    try {
      await assert.rejects(
        () => runChecks({ projectRoot: PROJECT_ROOT, baselinePath: tmpFile }),
        { message: /missing required field "reason"/ }
      );
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('should reject baseline with unknown ruleId', async () => {
    const tmpFile = join(tmpdir(), 'test-bad-baseline-' + Date.now() + '.json');
    writeFileSync(tmpFile, JSON.stringify([{ fingerprint: 'a'.repeat(16), ruleId: 'fake/rule', reason: 'test' }]));
    try {
      await assert.rejects(
        () => runChecks({ projectRoot: PROJECT_ROOT, baselinePath: tmpFile }),
        { message: /unknown ruleId/ }
      );
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('should reject baseline with invalid fingerprint format', async () => {
    const tmpFile = join(tmpdir(), 'test-bad-baseline-' + Date.now() + '.json');
    writeFileSync(tmpFile, JSON.stringify([{ fingerprint: 'not-hex', ruleId: 'prefab/json-valid', reason: 'test' }]));
    try {
      await assert.rejects(
        () => runChecks({ projectRoot: PROJECT_ROOT, baselinePath: tmpFile }),
        { message: /must be exactly 16 lowercase hex chars/ }
      );
    } finally {
      unlinkSync(tmpFile);
    }
  });
});

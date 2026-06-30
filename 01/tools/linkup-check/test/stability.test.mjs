import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks } from '../src/index.mjs';
import { createFingerprint } from '../src/diagnostics.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Use absolute path so the test works regardless of CWD
// Test is at 01/tools/linkup-check/test/, project is at 01/LinkUpClient/
const PROJECT_ROOT = join(__dirname, '..', '..', '..', 'LinkUpClient');

describe('Stability', () => {
  it('should produce identical results on consecutive runs', async () => {
    const result1 = await runChecks({ projectRoot: PROJECT_ROOT });
    const result2 = await runChecks({ projectRoot: PROJECT_ROOT });

    assert.ok(result1.diagnostics.length > 0, 'Should find diagnostics in the project');
    assert.equal(result1.diagnostics.length, result2.diagnostics.length,
      'Same number of diagnostics');

    // Sort both by the same criteria for comparison
    const sortFn = (a, b) => {
      if (a.ruleId !== b.ruleId) return a.ruleId.localeCompare(b.ruleId);
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      if (a.line && b.line) return a.line - b.line;
      return 0;
    };

    const sorted1 = [...result1.diagnostics].sort(sortFn);
    const sorted2 = [...result2.diagnostics].sort(sortFn);

    for (let i = 0; i < sorted1.length; i++) {
      assert.equal(sorted1[i].fingerprint, sorted2[i].fingerprint,
        `Fingerprint match at index ${i}: ${sorted1[i].ruleId} ${sorted1[i].file}`);
      assert.equal(sorted1[i].severity, sorted2[i].severity,
        `Severity match at index ${i}`);
      assert.equal(sorted1[i].message, sorted2[i].message,
        `Message match at index ${i}`);
    }

    // Summary must also match
    assert.deepEqual(result1.summary, result2.summary);
  });

  it('fingerprint should be deterministic', () => {
    const fp1 = createFingerprint('test/rule', 'file.ts', 'subject', 'message');
    const fp2 = createFingerprint('test/rule', 'file.ts', 'subject', 'message');
    assert.equal(fp1, fp2);
    assert.equal(fp1.length, 16);
  });

  it('different inputs should produce different fingerprints', () => {
    const fp1 = createFingerprint('test/rule', 'file.ts', 'subject', 'message1');
    const fp2 = createFingerprint('test/rule', 'file.ts', 'subject', 'message2');
    assert.notEqual(fp1, fp2);
  });
});

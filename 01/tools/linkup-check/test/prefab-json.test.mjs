import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPrefabJson } from '../src/rules/prefab-json.mjs';
import { parsePrefab } from '../src/prefab-parser.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

describe('prefab/json-valid', () => {
  it('should pass for a valid prefab', () => {
    const content = readFileSync(join(fixturesDir, 'UIValid.prefab'), 'utf-8');
    const parsed = parsePrefab(content, 'UIValid.prefab');
    assert.ok(!parsed.error, 'Should parse without error');
    assert.ok(parsed.root, 'Should have root node');
    assert.equal(parsed.root._name, 'UIValid');
  });

  it('should fail for invalid JSON', () => {
    const content = readFileSync(join(fixturesDir, 'broken.json.prefab'), 'utf-8');
    const parsed = parsePrefab(content, 'broken.json.prefab');
    assert.ok(parsed.error, 'Should have parse error');
    assert.ok(parsed.error.includes('Invalid JSON'));
  });

  it('should report error for unreadable file', () => {
    const diags = checkPrefabJson({
      relPath: 'nonexistent.prefab',
      absPath: '/nonexistent/path.prefab',
    });
    assert.equal(diags.length, 1);
    assert.equal(diags[0].severity, 'error');
    assert.equal(diags[0].ruleId, 'prefab/json-valid');
    assert.ok(diags[0].message.includes('Cannot read file'));
  });

  it('should detect non-array JSON', () => {
    const parsed = parsePrefab('{"not": "array"}', 'test.prefab');
    assert.ok(parsed.error, 'Should error for non-array');
    assert.ok(parsed.error.includes('not a JSON array'));
  });

  it('should detect missing cc.Prefab', () => {
    const parsed = parsePrefab('[{"__type__": "cc.Node", "_name": "test"}]', 'test.prefab');
    assert.ok(parsed.error, 'Should error when no cc.Prefab found');
  });
});

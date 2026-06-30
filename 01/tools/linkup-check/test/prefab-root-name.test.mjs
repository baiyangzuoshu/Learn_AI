import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPrefabRootName } from '../src/rules/prefab-root-name.mjs';
import { parsePrefab } from '../src/prefab-parser.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function makePrefab(relPath, rootName) {
  const json = JSON.stringify([
    { __type__: 'cc.Prefab', _name: rootName, data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: rootName, _children: [], _components: [] },
  ]);
  const parsed = parsePrefab(json, relPath);
  return { relPath, absPath: join(fixturesDir, relPath), parsed };
}

describe('ui/prefab-root-name', () => {
  it('should pass when file name matches root node name', () => {
    const prefabs = [makePrefab('UIValid.prefab', 'UIValid')];
    const diags = checkPrefabRootName(prefabs);
    assert.equal(diags.length, 0, 'Should have no errors');
  });

  it('should fail when file name does not match root node name', () => {
    const prefabs = [makePrefab('UIMismatch.prefab', 'UIWrongRoot')];
    const diags = checkPrefabRootName(prefabs);
    assert.equal(diags.length, 1);
    assert.equal(diags[0].severity, 'error');
    assert.equal(diags[0].ruleId, 'ui/prefab-root-name');
    assert.ok(diags[0].message.includes('UIMismatch'));
    assert.ok(diags[0].message.includes('UIWrongRoot'));
  });

  it('should detect duplicate root node names', () => {
    const prefabs = [
      makePrefab('UISame.prefab', 'UISame'),
      makePrefab('UISameCopy.prefab', 'UISame'),
    ];
    const diags = checkPrefabRootName(prefabs);
    // First prefab: file name mismatch (UISame vs UISame) - actually matches, so no mismatch error
    // But UISameCopy.prefab has root name UISame - mismatch error
    // Plus 2 duplicate errors
    const duplicateDiags = diags.filter(d => d.message.includes('duplicated'));
    assert.equal(duplicateDiags.length, 2, 'Should have 2 duplicate errors');
  });

  it('should skip prefabs with parse errors', () => {
    const prefabs = [
      { relPath: 'broken.prefab', absPath: '/nonexistent', parsed: null, error: 'Invalid JSON' },
    ];
    const diags = checkPrefabRootName(prefabs);
    assert.equal(diags.length, 0);
  });

  it('should fail for empty root node name', () => {
    const prefabs = [makePrefab('EmptyName.prefab', '')];
    const diags = checkPrefabRootName(prefabs);
    assert.equal(diags.length, 1);
    assert.ok(diags[0].message.includes('no root node name'));
  });
});

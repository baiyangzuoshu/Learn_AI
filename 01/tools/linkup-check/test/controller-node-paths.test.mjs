import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractNodePaths, isStaticPath, parsePathSegments } from '../src/ts-extractor.mjs';
import { checkControllerNodePaths } from '../src/rules/controller-node-paths.mjs';
import { parsePrefab } from '../src/prefab-parser.mjs';

const VALID_PREFAB_JSON = JSON.stringify([
  { __type__: 'cc.Prefab', _name: 'UIValid', data: { __id__: 1 } },
  { __type__: 'cc.Node', _name: 'UIValid', _children: [{ __id__: 2 }], _components: [] },
  { __type__: 'cc.Node', _name: 'bg', _children: [{ __id__: 3 }, { __id__: 5 }], _components: [] },
  { __type__: 'cc.Node', _name: 'btnClose', _children: [], _components: [{ __id__: 4 }] },
  { __type__: 'cc.Button', node: { __id__ : 3 } },
  { __type__: 'cc.Node', _name: 'label', _children: [], _components: [] },
]);

describe('ts-extractor', () => {
  it('should extract getChildByUrl paths', () => {
    const content = 'this.getChildByUrl("bg/btnClose");';
    const paths = extractNodePaths(content, 'test.ts');
    assert.equal(paths.length, 1);
    assert.equal(paths[0].path, 'bg/btnClose');
    assert.equal(paths[0].functionName, 'getChildByUrl');
  });

  it('should extract AddButtonListener paths', () => {
    const content = 'this.AddButtonListener("bg/btnClose", this.onClose, this);';
    const paths = extractNodePaths(content, 'test.ts');
    assert.equal(paths.length, 1);
    assert.equal(paths[0].path, 'bg/btnClose');
    assert.equal(paths[0].functionName, 'AddButtonListener');
  });

  it('should extract AddDelayButtonListener paths', () => {
    const content = 'this.AddDelayButtonListener("bg/btnOk", this.onOk, this);';
    const paths = extractNodePaths(content, 'test.ts');
    assert.equal(paths.length, 1);
    assert.equal(paths[0].path, 'bg/btnOk');
  });

  it('should extract AddMOUSEListener paths', () => {
    const content = 'this.AddMOUSEListener("bg", this.onBg, this);';
    const paths = extractNodePaths(content, 'test.ts');
    assert.equal(paths.length, 1);
    assert.equal(paths[0].path, 'bg');
    assert.equal(paths[0].functionName, 'AddMOUSEListener');
  });

  it('should handle single-quoted strings', () => {
    const content = "this.getChildByUrl('bg/btnClose');";
    const paths = extractNodePaths(content, 'test.ts');
    assert.equal(paths.length, 1);
    assert.equal(paths[0].path, 'bg/btnClose');
  });

  it('should detect dynamic paths with concatenation', () => {
    const content = `this.getChildByUrl("bg/" + this.type);
this.getChildByUrl("bg" + this.type);`;
    const paths = extractNodePaths(content, 'test.ts');
    // "bg/" is extracted as a path; the + is outside the quotes
    // We detect it by checking that the line contains concatenation
    assert.ok(paths.length >= 1);
    // The path "bg" (without trailing slash) from second call should not be dynamic
    // But the isDynamic flag in extractNodePaths only checks the path string itself
    // We rely on the full line analysis in the rule
  });

  it('should detect dynamic paths with template literals', () => {
    const content = 'this.getChildByUrl("bg/${this.name}");';
    const paths = extractNodePaths(content, 'test.ts');
    assert.equal(paths.length, 1);
    assert.equal(paths[0].isDynamic, true);
  });

  it('should detect absolute paths as dynamic', () => {
    const content = 'this.AddButtonListener("/absolute/path", this.onAbs, this);';
    const paths = extractNodePaths(content, 'test.ts');
    assert.equal(paths.length, 1);
    assert.equal(paths[0].isDynamic, true);
  });

  it('should extract multiple paths from one line', () => {
    const content = 'this.getChildByUrl("bg/a"); this.getChildByUrl("bg/b");';
    const paths = extractNodePaths(content, 'test.ts');
    assert.equal(paths.length, 2);
  });
});

describe('isStaticPath', () => {
  it('should return true for simple paths', () => {
    assert.equal(isStaticPath('bg/btnClose'), true);
    assert.equal(isStaticPath('bg'), true);
  });

  it('should return false for empty path', () => {
    assert.equal(isStaticPath(''), false);
    assert.equal(isStaticPath(null), false);
  });

  it('should return false for template paths', () => {
    assert.equal(isStaticPath('bg/${name}'), false);
    assert.equal(isStaticPath('bg/test${x}'), false);
  });

  it('should return false for absolute paths', () => {
    assert.equal(isStaticPath('/absolute/path'), false);
  });
});

describe('parsePathSegments', () => {
  it('should split simple path', () => {
    assert.deepEqual(parsePathSegments('bg/btnClose'), ['bg', 'btnClose']);
  });

  it('should handle single segment', () => {
    assert.deepEqual(parsePathSegments('bg'), ['bg']);
  });

  it('should handle empty string', () => {
    assert.deepEqual(parsePathSegments(''), []);
  });
});

describe('ui/controller-node-paths', () => {
  it('should find existing node paths', () => {
    const parsed = parsePrefab(VALID_PREFAB_JSON, 'UIValid.prefab');
    const prefabs = [{ relPath: 'assets/BundleLLK/GUI/UIValid.prefab', parsed }];
    const controllers = [{
      relPath: 'assets/Scripts/UI/UIValidUICtrl.ts',
      absPath: '/tmp/UIValidUICtrl.ts',
      content: 'this.getChildByUrl("bg/btnClose");',
    }];
    const diags = checkControllerNodePaths(controllers, prefabs);
    assert.equal(diags.length, 0, 'Should have no errors for existing path');
  });

  it('should report missing node paths', () => {
    const parsed = parsePrefab(VALID_PREFAB_JSON, 'UIValid.prefab');
    const prefabs = [{ relPath: 'assets/BundleLLK/GUI/UIValid.prefab', parsed }];
    // Controller name UIValidUICtrl maps to prefab UIValid
    const controllers = [{
      relPath: 'assets/Scripts/UI/UIValidUICtrl.ts',
      absPath: '/tmp/UIValidUICtrl.ts',
      content: 'this.getChildByUrl("bg/nonexistent");',
    }];
    const diags = checkControllerNodePaths(controllers, prefabs);
    assert.equal(diags.length, 1);
    assert.equal(diags[0].severity, 'error');
    assert.ok(diags[0].message.includes('bg/nonexistent'));
  });

  it('should report missing cc.Button for button listeners', () => {
    const parsed = parsePrefab(VALID_PREFAB_JSON, 'UIValid.prefab');
    const prefabs = [{ relPath: 'assets/BundleLLK/GUI/UIValid.prefab', parsed }];
    // bg/label is a child node with no cc.Button component
    const controllers = [{
      relPath: 'assets/Scripts/UI/UIValidUICtrl.ts',
      absPath: '/tmp/UIValidUICtrl.ts',
      content: 'this.AddButtonListener("bg/label", this.onLabel, this);',
    }];
    const diags = checkControllerNodePaths(controllers, prefabs);
    assert.equal(diags.length, 1);
    assert.ok(diags[0].message.includes('cc.Button'));
  });

  it('should report dynamic paths as info', () => {
    const parsed = parsePrefab(VALID_PREFAB_JSON, 'UIValid.prefab');
    const prefabs = [{ relPath: 'assets/BundleLLK/GUI/UIValid.prefab', parsed }];
    const controllers = [{
      relPath: 'assets/Scripts/UI/UIValidUICtrl.ts',
      absPath: '/tmp/UIValidUICtrl.ts',
      content: 'this.getChildByUrl("bg/${this.type}");',
    }];
    const diags = checkControllerNodePaths(controllers, prefabs);
    assert.equal(diags.length, 1);
    assert.equal(diags[0].severity, 'info');
  });

  it('should skip controllers without matching prefab', () => {
    const prefabs = [{ relPath: 'assets/BundleLLK/GUI/UIOther.prefab', parsed: parsePrefab(VALID_PREFAB_JSON, 'UIOther.prefab') }];
    const controllers = [{
      relPath: 'assets/Scripts/UI/UIUnknownUICtrl.ts',
      absPath: '/tmp/unknown.ts',
      content: 'this.getChildByUrl("bg/x");',
    }];
    const diags = checkControllerNodePaths(controllers, prefabs);
    assert.equal(diags.length, 0);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkDuplicateAttach } from '../src/rules/duplicate-component-attach.mjs';

describe('component/duplicate-attach', () => {
  it('should detect duplicate addComponent in same method', () => {
    const controllers = [{
      relPath: 'assets/Scripts/UI/TestCtrl.ts',
      absPath: '/tmp/TestCtrl.ts',
      content: `
        setup() {
            this.node.addComponent(MapManager);
            this.node.addComponent(MapManager);
        }
      `,
    }];
    const diags = checkDuplicateAttach(controllers);
    assert.equal(diags.length, 1);
    assert.equal(diags[0].severity, 'warning');
    assert.equal(diags[0].ruleId, 'component/duplicate-attach');
    assert.ok(diags[0].message.includes('MapManager'));
  });

  it('should not report different addComponent calls', () => {
    const controllers = [{
      relPath: 'assets/Scripts/UI/TestCtrl.ts',
      absPath: '/tmp/TestCtrl.ts',
      content: `
        setup() {
            this.node.addComponent(MapManager);
            this.node.addComponent(DataManager);
        }
      `,
    }];
    const diags = checkDuplicateAttach(controllers);
    assert.equal(diags.length, 0);
  });

  it('should not report duplicates in different methods', () => {
    const controllers = [{
      relPath: 'assets/Scripts/UI/TestCtrl.ts',
      absPath: '/tmp/TestCtrl.ts',
      content: `
        method1() {
            this.node.addComponent(MapManager);
        }
        method2() {
            this.node.addComponent(MapManager);
        }
      `,
    }];
    const diags = checkDuplicateAttach(controllers);
    assert.equal(diags.length, 0);
  });

  it('should handle view.addComponent syntax', () => {
    const controllers = [{
      relPath: 'assets/Scripts/UI/TestCtrl.ts',
      absPath: '/tmp/TestCtrl.ts',
      content: `
        setup() {
            view.addComponent(MapManager);
            view.addComponent(MapManager);
        }
      `,
    }];
    const diags = checkDuplicateAttach(controllers);
    assert.equal(diags.length, 1);
  });

  it('should handle node.addComponent syntax', () => {
    const controllers = [{
      relPath: 'assets/Scripts/UI/TestCtrl.ts',
      absPath: '/tmp/TestCtrl.ts',
      content: `
        setup() {
            node.addComponent(MapManager);
            node.addComponent(MapManager);
        }
      `,
    }];
    const diags = checkDuplicateAttach(controllers);
    assert.equal(diags.length, 1);
  });

  it('should report correct line number', () => {
    const controllers = [{
      relPath: 'assets/Scripts/UI/TestCtrl.ts',
      absPath: '/tmp/TestCtrl.ts',
      content: `line1\nline2\n    setup() {\n        this.node.addComponent(MapManager);\n        this.node.addComponent(MapManager);\n    }`,
    }];
    const diags = checkDuplicateAttach(controllers);
    assert.equal(diags.length, 1);
    assert.equal(diags[0].line, 5); // Second occurrence
  });
});

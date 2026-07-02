/**
 * Integration tests using minimal-linkup fixture.
 * Tests tool handlers and resource content against the fixture.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectContext, type ProjectContext } from '../../src/project-context.js';
import { handleValidateProject } from '../../src/tools/validate-project.js';
import { handleInspectUiPrefab } from '../../src/tools/inspect-ui-prefab.js';
import { handleResolveUiContract } from '../../src/tools/resolve-ui-contract.js';
import { readProjectProfile } from '../../src/resources/project-profile.js';
import { readProjectArchitecture } from '../../src/resources/project-architecture.js';
import { readUiContracts } from '../../src/resources/ui-contracts.js';
import { readValidationRules } from '../../src/resources/validation-rules.js';
import { buildProjectIndex, runChecks, listRules, parsePrefab, getRootNodeName, walkNodes, getComponents, nodeHasComponent, extractNodePaths } from 'linkup-check';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Compiled test is at dist/test/integration/fixture.test.js
// Fixtures are at test/fixtures/minimal-linkup/
// Need to go up 4 levels: integration -> test -> dist -> project root
const FIXTURE_ROOT = resolve(__dirname, '..', '..', '..', 'test', 'fixtures', 'minimal-linkup');

describe('Integration: Minimal Fixture', () => {
  let ctx: ProjectContext;

  before(async () => {
    const result = await createProjectContext(
      {
        projectRoot: FIXTURE_ROOT,
        baselinePath: resolve(FIXTURE_ROOT, 'nonexistent-baseline.json'),
        maxTreeDepth: 8,
        maxTreeNodes: 2000,
        maxDiagnostics: 500,
        logLevel: 'info',
        runtimeHost: '127.0.0.1',
        runtimePort: 9222,
        runtimeTimeoutMs: 5000,
        runtimeMaxConsoleLogs: 1000,
      },
      {
        runChecks: async (opts: any) => {
          try {
            return await runChecks({
              projectRoot: FIXTURE_ROOT,
              ...opts,
            });
          } catch {
            return { diagnostics: [], summary: { total: 0, errors: 0, warnings: 0, infos: 0, passedRules: 0, activeRules: listRules() } };
          }
        },
        buildProjectIndex: (root: string) => buildProjectIndex(root),
        parsePrefab: (c: string, p: string) => parsePrefab(c, p),
        getRootNodeName: (p: any) => getRootNodeName(p),
        walkNodes: (p: any) => walkNodes(p),
        getComponents: (p: any) => getComponents(p),
        nodeHasComponent: (p: any, path: string, type: string) => nodeHasComponent(p, path, type),
        extractNodePaths: (c: string, p: string) => extractNodeNodes(c, p),
        listRules: () => listRules(),
      }
    );

    // Use the real extractNodePaths
    const realResult = await createProjectContext(
      {
        projectRoot: FIXTURE_ROOT,
        baselinePath: resolve(FIXTURE_ROOT, 'nonexistent-baseline.json'),
        maxTreeDepth: 8,
        maxTreeNodes: 2000,
        maxDiagnostics: 500,
        logLevel: 'info',
        runtimeHost: '127.0.0.1',
        runtimePort: 9222,
        runtimeTimeoutMs: 5000,
        runtimeMaxConsoleLogs: 1000,
      },
      {
        runChecks: async (opts: any) => {
          try {
            return await runChecks({ projectRoot: FIXTURE_ROOT, ...opts });
          } catch {
            return { diagnostics: [], summary: { total: 0, errors: 0, warnings: 0, infos: 0, passedRules: 0, activeRules: listRules() } };
          }
        },
        buildProjectIndex: (root: string) => buildProjectIndex(root),
        parsePrefab: (c: string, p: string) => parsePrefab(c, p),
        getRootNodeName: (p: any) => getRootNodeName(p),
        walkNodes: (p: any) => walkNodes(p),
        getComponents: (p: any) => getComponents(p),
        nodeHasComponent: (p: any, path: string, type: string) => nodeHasComponent(p, path, type),
        extractNodePaths: (c: string, p: string) => extractNodePaths(c, p),
        listRules: () => listRules(),
      }
    );

    assert.ok(realResult.context, 'Should create context');
    ctx = realResult.context!;
  });

  it('should build project index', () => {
    const index = ctx.getIndex();
    assert.ok(index, 'Should have index');
    assert.strictEqual(index.projectRoot, FIXTURE_ROOT);
    assert.ok(index.prefabs.length >= 2, `Should have at least 2 prefabs, got ${index.prefabs.length}`);
  });

  it('should parse UITest prefab', () => {
    const index = ctx.getIndex();
    const uiTest = index.prefabs.find(p => p.relPath.includes('UITest.prefab'));
    assert.ok(uiTest, 'Should find UITest prefab');
    assert.ok(uiTest!.parsed, 'Should parse successfully');
    assert.ok(!uiTest!.error, 'Should have no error');
  });

  it('should find UITest root node name', () => {
    const index = ctx.getIndex();
    const uiTest = index.prefabs.find(p => p.relPath.includes('UITest.prefab'));
    assert.ok(uiTest?.parsed);
    const rootName = getRootNodeName(uiTest!.parsed!);
    assert.strictEqual(rootName, 'UITest');
  });

  it('should walk UITest nodes with depth', () => {
    const index = ctx.getIndex();
    const uiTest = index.prefabs.find(p => p.relPath.includes('UITest.prefab'));
    assert.ok(uiTest?.parsed);
    const nodes = walkNodes(uiTest!.parsed!);
    assert.ok(nodes.length >= 4, `Should have at least 4 nodes, got ${nodes.length}`);
    // Root + bg + label + btnStart
    const names = nodes.map(n => n.name);
    assert.ok(names.includes('UITest'));
    assert.ok(names.includes('bg'));
    assert.ok(names.includes('btnStart'));
  });

  it('should find components on btnStart node', () => {
    const index = ctx.getIndex();
    const uiTest = index.prefabs.find(p => p.relPath.includes('UITest.prefab'));
    assert.ok(uiTest?.parsed);
    assert.ok(nodeHasComponent(uiTest!.parsed!, 'UITest/bg/btnStart', 'cc.Button'));
    assert.ok(!nodeHasComponent(uiTest!.parsed!, 'UITest/bg', 'cc.Button'));
  });

  it('should extract node paths from controller', () => {
    const index = ctx.getIndex();
    const ctrl = index.controllers.find(c => c.relPath.includes('UITestUICtrl'));
    assert.ok(ctrl, 'Should find controller');
    const paths = extractNodePaths(ctrl!.content, ctrl!.relPath);
    assert.ok(paths.length >= 2, `Should have at least 2 paths, got ${paths.length}`);
    const pathStrs = paths.map(p => p.path);
    assert.ok(pathStrs.includes('bg/btnStart'));
    assert.ok(pathStrs.includes('bg/label'));
  });

  it('should find UIName and UIControllerName in constants', () => {
    const index = ctx.getIndex();
    assert.strictEqual(index.constants.uiNames['UITest'], 'UITest');
    assert.strictEqual(index.constants.uiControllerNames['UIController_UITest'], 'UITest');
  });

  it('should find registration in UIController', () => {
    const index = ctx.getIndex();
    const regs = index.uiController.registrations;
    assert.ok(regs.length >= 1, 'Should have at least 1 registration');
    const testReg = regs.find(r => r.controllerName === 'UIController_UITest');
    assert.ok(testReg, 'Should find UITest registration');
    assert.strictEqual(testReg!.uiName, 'UITest');
  });
});

// Helper that was referenced incorrectly above; not used
function extractNodeNodes(c: string, p: string) {
  return extractNodePaths(c, p);
}

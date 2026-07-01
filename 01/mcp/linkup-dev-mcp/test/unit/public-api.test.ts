/**
 * Public API test: verify all G1 re-exports are accessible from package root.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as linkupCheck from 'linkup-check';

describe('G1 Public API', () => {
  it('should export runChecks', () => {
    assert.strictEqual(typeof linkupCheck.runChecks, 'function');
  });

  it('should export listRules', () => {
    assert.strictEqual(typeof linkupCheck.listRules, 'function');
    const rules = linkupCheck.listRules();
    assert.ok(Array.isArray(rules));
    assert.ok(rules.length > 0, 'Should have at least 1 rule');
  });

  it('should export buildProjectIndex (G3 re-export)', () => {
    assert.strictEqual(typeof linkupCheck.buildProjectIndex, 'function');
  });

  it('should export parsePrefab (G3 re-export)', () => {
    assert.strictEqual(typeof linkupCheck.parsePrefab, 'function');
  });

  it('should export getRootNodeName (G3 re-export)', () => {
    assert.strictEqual(typeof linkupCheck.getRootNodeName, 'function');
  });

  it('should export walkNodes (G3 re-export)', () => {
    assert.strictEqual(typeof linkupCheck.walkNodes, 'function');
  });

  it('should export getComponents (G3 re-export)', () => {
    assert.strictEqual(typeof linkupCheck.getComponents, 'function');
  });

  it('should export nodeHasComponent (G3 re-export)', () => {
    assert.strictEqual(typeof linkupCheck.nodeHasComponent, 'function');
  });

  it('should export extractNodePaths (G3 re-export)', () => {
    assert.strictEqual(typeof linkupCheck.extractNodePaths, 'function');
  });

  it('should export createDiagnostic', () => {
    assert.strictEqual(typeof linkupCheck.createDiagnostic, 'function');
  });

  it('should export applyBaseline', () => {
    assert.strictEqual(typeof linkupCheck.applyBaseline, 'function');
  });

  it('should export computeSummary', () => {
    assert.strictEqual(typeof linkupCheck.computeSummary, 'function');
  });

  it('should export formatText', () => {
    assert.strictEqual(typeof linkupCheck.formatText, 'function');
  });

  it('should export formatJSON', () => {
    assert.strictEqual(typeof linkupCheck.formatJSON, 'function');
  });
});

/**
 * Unit tests for Runtime CDP Manager and Whitelist.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CDPManager, createCDPManager } from '../../src/runtime/cdp-manager.js';
import {
  buildSceneTreeExpression,
  buildNodeDetailExpression,
  buildStatusExpression,
} from '../../src/runtime/whitelist.js';
import { ErrorCode } from '../../src/errors.js';

describe('CDPManager', () => {
  it('should create with default config', () => {
    const mgr = createCDPManager();
    assert.equal(mgr.isConnected(), false);
    const status = mgr.getStatus();
    assert.equal(status.connected, false);
  });

  it('should create with custom config', () => {
    const mgr = createCDPManager({ host: '0.0.0.0', port: 9333, timeoutMs: 10000 });
    assert.equal(mgr.isConnected(), false);
  });

  it('should return disconnected status when not connected', () => {
    const mgr = createCDPManager();
    const status = mgr.getStatus();
    assert.equal(status.connected, false);
    assert.equal(status.scene, undefined);
  });

  it('should return empty console logs when not connected', () => {
    const mgr = createCDPManager();
    const logs = mgr.getConsoleLogs();
    assert.deepEqual(logs, []);
  });

  it('should return empty console logs with filters when not connected', () => {
    const mgr = createCDPManager();
    const logs = mgr.getConsoleLogs({ level: 'error', limit: 10 });
    assert.deepEqual(logs, []);
  });

  it('should treat warn and warning filters as equivalent', () => {
    const mgr = createCDPManager();
    (mgr as any).consoleBuffer = [
      { level: 'warning', text: 'warning-entry', timestamp: 1 },
      { level: 'warn', text: 'warn-entry', timestamp: 2 },
      { level: 'error', text: 'error-entry', timestamp: 3 },
    ];

    const warnLogs = mgr.getConsoleLogs({ level: 'warn' });
    const warningLogs = mgr.getConsoleLogs({ level: 'warning' });

    assert.deepEqual(
      warnLogs.map(l => l.text),
      ['warning-entry', 'warn-entry']
    );
    assert.deepEqual(
      warningLogs.map(l => l.text),
      ['warning-entry', 'warn-entry']
    );
  });

  it('disconnect should be idempotent', async () => {
    const mgr = createCDPManager();
    await mgr.disconnect(); // Should not throw
    await mgr.disconnect(); // Should not throw
    assert.equal(mgr.isConnected(), false);
  });
});

describe('Whitelist - buildSceneTreeExpression', () => {
  it('should return a string expression', () => {
    const expr = buildSceneTreeExpression(4, 100);
    assert.equal(typeof expr, 'string');
    assert.ok(expr.includes('cc.director.getScene'));
  });

  it('should clamp maxDepth to 1-8', () => {
    const expr1 = buildSceneTreeExpression(0, 100);
    assert.ok(expr1.includes('MAX_DEPTH = 1'));

    const expr2 = buildSceneTreeExpression(100, 100);
    assert.ok(expr2.includes('MAX_DEPTH = 8'));
  });

  it('should clamp maxNodes to 1-2000', () => {
    const expr1 = buildSceneTreeExpression(4, 0);
    assert.ok(expr1.includes('MAX_NODES = 1'));

    const expr2 = buildSceneTreeExpression(4, 99999);
    assert.ok(expr2.includes('MAX_NODES = 2000'));
  });

  it('should not contain arbitrary eval', () => {
    const expr = buildSceneTreeExpression(4, 100);
    assert.ok(!expr.includes('eval('));
    assert.ok(!expr.includes('Function('));
  });
});

describe('Whitelist - buildNodeDetailExpression', () => {
  it('should accept valid node paths', () => {
    const expr = buildNodeDetailExpression('Canvas/UIRoot/UISet');
    assert.equal(typeof expr, 'string');
    assert.ok(expr.includes('Canvas/UIRoot/UISet'));
  });

  it('should accept root path', () => {
    const expr = buildNodeDetailExpression('/');
    assert.equal(typeof expr, 'string');
  });

  it('should reject paths with special characters', () => {
    assert.throws(
      () => buildNodeDetailExpression('node<script>'),
      /disallowed characters/
    );
    assert.throws(
      () => buildNodeDetailExpression('node;alert(1)'),
      /disallowed characters/
    );
    assert.throws(
      () => buildNodeDetailExpression('node"test'),
      /disallowed characters/
    );
  });

  it('should reject paths longer than 512 characters', () => {
    const longPath = 'a'.repeat(513);
    assert.throws(
      () => buildNodeDetailExpression(longPath),
      /too long/
    );
  });

  it('should not contain eval or Function', () => {
    const expr = buildNodeDetailExpression('Canvas/UIRoot');
    assert.ok(!expr.includes('eval('));
    assert.ok(!expr.includes('Function('));
  });
});

describe('Whitelist - buildStatusExpression', () => {
  it('should return a string expression', () => {
    const expr = buildStatusExpression();
    assert.equal(typeof expr, 'string');
    assert.ok(expr.includes('cc.director.getScene'));
    assert.ok(expr.includes('cc.Canvas.instance'));
  });

  it('should not contain eval', () => {
    const expr = buildStatusExpression();
    assert.ok(!expr.includes('eval('));
    assert.ok(!expr.includes('Function('));
  });
});

describe('Runtime Error Codes', () => {
  it('should include all G4 runtime error codes', async () => {
    // Import dynamically to verify the module loads
    const { ErrorCode: codes } = await import('../../src/errors.js');
    assert.equal(codes.RUNTIME_UNAVAILABLE, 'RUNTIME_UNAVAILABLE');
    assert.equal(codes.RUNTIME_TIMEOUT, 'RUNTIME_TIMEOUT');
    assert.equal(codes.RUNTIME_CONNECT_FAILED, 'RUNTIME_CONNECT_FAILED');
    assert.equal(codes.RUNTIME_TARGET_NOT_FOUND, 'RUNTIME_TARGET_NOT_FOUND');
    assert.equal(codes.RUNTIME_PROTOCOL_ERROR, 'RUNTIME_PROTOCOL_ERROR');
    assert.equal(codes.RUNTIME_LIMIT_EXCEEDED, 'RUNTIME_LIMIT_EXCEEDED');
  });
});

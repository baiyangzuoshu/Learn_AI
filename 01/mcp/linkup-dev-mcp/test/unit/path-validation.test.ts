/**
 * Unit tests for path validation and containment.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateRelativePath, isWithinRoot } from '../../src/project-context.js';

describe('Path Validation', () => {
  it('should accept valid relative path', () => {
    const result = validateRelativePath('assets/Scripts/Constant.ts');
    assert.strictEqual(result.valid, true);
  });

  it('should reject empty string', () => {
    const result = validateRelativePath('');
    assert.strictEqual(result.valid, false);
  });

  it('should reject null/undefined', () => {
    const result = validateRelativePath(null as any);
    assert.strictEqual(result.valid, false);
  });

  it('should reject absolute path', () => {
    const result = validateRelativePath('/etc/passwd');
    assert.strictEqual(result.valid, false);
  });

  it('should reject path with ..', () => {
    const result = validateRelativePath('../outside');
    assert.strictEqual(result.valid, false);
  });

  it('should reject path with embedded ..', () => {
    const result = validateRelativePath('assets/../../../etc/passwd');
    assert.strictEqual(result.valid, false);
  });

  it('should reject NUL byte', () => {
    const result = validateRelativePath('assets/file\0.txt');
    assert.strictEqual(result.valid, false);
  });

  it('should reject URL-encoded path traversal', () => {
    const result = validateRelativePath('assets/%2e%2e/escape');
    assert.strictEqual(result.valid, false);
  });
});

describe('Root Containment', () => {
  it('should accept path within root', () => {
    assert.strictEqual(isWithinRoot('/project/src/file.ts', '/project'), true);
  });

  it('should reject path outside root', () => {
    assert.strictEqual(isWithinRoot('/etc/passwd', '/project'), false);
  });

  it('should reject parent path', () => {
    assert.strictEqual(isWithinRoot('/other/file', '/project'), false);
  });
});

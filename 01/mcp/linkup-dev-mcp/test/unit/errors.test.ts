/**
 * Unit tests for error handling.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createError, mapError, ErrorCode } from '../../src/errors.js';

describe('Errors', () => {
  it('should create structured error', () => {
    const err = createError(ErrorCode.UI_NOT_FOUND, 'UI not found');
    assert.strictEqual(err.code, 'UI_NOT_FOUND');
    assert.strictEqual(err.message, 'UI not found');
  });

  it('should map Error instance', () => {
    const mapped = mapError(new Error('test error'));
    assert.strictEqual(mapped.code, 'INTERNAL_ERROR');
    assert.strictEqual(mapped.message, 'test error');
  });

  it('should map string error', () => {
    const mapped = mapError('string error');
    assert.strictEqual(mapped.code, 'INTERNAL_ERROR');
    assert.strictEqual(mapped.message, 'string error');
  });

  it('should pass through structured error', () => {
    const original = createError(ErrorCode.CHECK_FAILED, 'check failed');
    const mapped = mapError(original);
    assert.strictEqual(mapped.code, 'CHECK_FAILED');
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateAgainstSchema } from '../src/schema-validator.mjs';

const schema = JSON.parse(await readFile(
  new URL('../schema/risk-assessment.schema.json', import.meta.url),
  'utf8',
));

test('accepts a valid assessment', () => {
  const value = {
    results: [{
      id: 'T01',
      risk: 'low',
      reason: '只读操作。',
      requiresApproval: false,
    }],
  };

  assert.deepEqual(validateAgainstSchema(value, schema), []);
});

test('rejects a missing required property', () => {
  const value = {
    results: [{
      id: 'T01',
      risk: 'low',
      reason: '只读操作。',
    }],
  };

  assert.ok(validateAgainstSchema(value, schema).some((error) => (
    error.keyword === 'required' && error.message.includes('requiresApproval')
  )));
});

test('rejects an invalid enum value', () => {
  const value = {
    results: [{
      id: 'T01',
      risk: 'critical',
      reason: '未知枚举。',
      requiresApproval: true,
    }],
  };

  assert.ok(validateAgainstSchema(value, schema).some((error) => error.keyword === 'enum'));
});

test('rejects a wrong primitive type', () => {
  const value = {
    results: [{
      id: 'T01',
      risk: 'low',
      reason: '类型错误。',
      requiresApproval: 'false',
    }],
  };

  assert.ok(validateAgainstSchema(value, schema).some((error) => (
    error.path === '$.results[0].requiresApproval' && error.keyword === 'type'
  )));
});

test('rejects undeclared properties', () => {
  const value = {
    results: [{
      id: 'T01',
      risk: 'low',
      reason: '出现额外字段。',
      requiresApproval: false,
      confidence: 0.9,
    }],
  };

  assert.ok(validateAgainstSchema(value, schema).some((error) => (
    error.path === '$.results[0].confidence' && error.keyword === 'additionalProperties'
  )));
});

test('rejects an empty results array', () => {
  assert.ok(validateAgainstSchema({ results: [] }, schema).some((error) => (
    error.path === '$.results' && error.keyword === 'minItems'
  )));
});

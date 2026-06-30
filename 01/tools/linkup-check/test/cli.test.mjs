import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, printHelp } from '../src/cli.mjs';

describe('CLI parseArgs', () => {
  it('should parse --project', () => {
    const opts = parseArgs(['node', 'script.mjs', '--project', '/path/to/project']);
    assert.equal(opts.project, '/path/to/project');
  });

  it('should parse -p shorthand', () => {
    const opts = parseArgs(['node', 'script.mjs', '-p', '/path']);
    assert.equal(opts.project, '/path');
  });

  it('should parse --format', () => {
    const opts = parseArgs(['node', 'script.mjs', '-p', '.', '-f', 'json']);
    assert.equal(opts.format, 'json');
  });

  it('should parse --rule (multiple)', () => {
    const opts = parseArgs(['node', 'script.mjs', '-p', '.', '-r', 'rule1', '-r', 'rule2']);
    assert.deepEqual(opts.rules, ['rule1', 'rule2']);
  });

  it('should parse --baseline', () => {
    const opts = parseArgs(['node', 'script.mjs', '-p', '.', '-b', './baseline.json']);
    assert.equal(opts.baseline, './baseline.json');
  });

  it('should parse --help', () => {
    const opts = parseArgs(['node', 'script.mjs', '--help']);
    assert.equal(opts.help, true);
  });

  it('should parse --list-rules', () => {
    const opts = parseArgs(['node', 'script.mjs', '--list-rules']);
    assert.equal(opts.listRules, true);
  });

  it('should treat bare arg as project path', () => {
    const opts = parseArgs(['node', 'script.mjs', './LinkUpClient']);
    assert.equal(opts.project, './LinkUpClient');
  });

  it('should default format to text', () => {
    const opts = parseArgs(['node', 'script.mjs', '-p', '.']);
    assert.equal(opts.format, 'text');
  });
});

describe('CLI runCLI', () => {
  it('should return 0 for --help', async () => {
    const { runCLI } = await import('../src/cli.mjs');
    const code = await runCLI(['node', 'script.mjs', '--help']);
    assert.equal(code, 0);
  });

  it('should return 0 for --list-rules', async () => {
    const { runCLI } = await import('../src/cli.mjs');
    const code = await runCLI(['node', 'script.mjs', '--list-rules']);
    assert.equal(code, 0);
  });

  it('should return 2 for missing --project', async () => {
    const { runCLI } = await import('../src/cli.mjs');
    const code = await runCLI(['node', 'script.mjs']);
    assert.equal(code, 2);
  });

  it('should return 2 for nonexistent project', async () => {
    const { runCLI } = await import('../src/cli.mjs');
    const code = await runCLI(['node', 'script.mjs', '-p', '/nonexistent/path']);
    assert.equal(code, 2);
  });
});

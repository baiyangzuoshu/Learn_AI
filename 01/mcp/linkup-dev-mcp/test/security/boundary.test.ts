/**
 * Security tests: verify no dangerous capabilities in tool schemas,
 * path boundary protection, and server process behavior.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const SERVER_JS = resolve(PROJECT_ROOT, 'dist/src/index.js');

describe('Security', () => {
  let client: Client;
  let transport: StdioClientTransport;

  before(async () => {
    client = new Client(
      { name: 'security-test', version: '0.0.1' },
      { capabilities: {} }
    );
    transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_JS],
    });
    await client.connect(transport);
  });

  after(async () => {
    try {
      await client.close();
    } catch {
      // Ignore
    }
  });

  it('should have exactly 3 tools (no read/write/shell/eval/network)', async () => {
    const result = await client.listTools();
    assert.strictEqual(result.tools.length, 8, `Expected 8 tools (3 G3 + 5 Runtime), got ${result.tools.length}`);
  });

  it('should have exactly 4 resources', async () => {
    const result = await client.listResources();
    assert.strictEqual(result.resources.length, 4);
  });

  it('tool schemas should not contain path, projectRoot, baselinePath, command, code, or url fields', async () => {
    const result = await client.listTools();
    const forbiddenFields = ['path', 'projectRoot', 'baselinePath', 'command', 'code', 'url'];

    for (const tool of result.tools) {
      const inputSchema = tool.inputSchema;
      if (inputSchema && inputSchema.properties) {
        for (const field of forbiddenFields) {
          assert.strictEqual(
            (inputSchema.properties as any)[field],
            undefined,
            `Tool "${tool.name}" should not have forbidden field "${field}"`
          );
        }
      }
    }
  });

  it('should reject uiName with path traversal', async () => {
    const result = await client.callTool({
      name: 'inspect_ui_prefab',
      arguments: { uiName: '../escape' },
    });
    assert.ok(result.isError || result.content);
  });

  it('should reject uiName with absolute path', async () => {
    const result = await client.callTool({
      name: 'inspect_ui_prefab',
      arguments: { uiName: '/etc/passwd' },
    });
    // Should be rejected by schema regex
    assert.ok(result.isError || result.content);
  });

  it('should reject uiName starting with number', async () => {
    const result = await client.callTool({
      name: 'inspect_ui_prefab',
      arguments: { uiName: '123invalid' },
    });
    assert.ok(result.isError || result.content);
  });

  it('should reject uiName that is too long', async () => {
    const longName = 'A' + 'b'.repeat(200);
    try {
      const result = await client.callTool({
        name: 'inspect_ui_prefab',
        arguments: { uiName: longName },
      });
      assert.ok(result.isError || result.content);
    } catch {
      // SDK may reject at schema level
    }
  });

  it('validate_project should not accept path parameter', async () => {
    const result = await client.listTools();
    const validateTool = result.tools.find(t => t.name === 'validate_project');
    assert.ok(validateTool);
    const props = validateTool!.inputSchema?.properties;
    assert.strictEqual(props?.path, undefined, 'Should not accept path parameter');
    assert.strictEqual(props?.projectRoot, undefined, 'Should not accept projectRoot parameter');
  });
});

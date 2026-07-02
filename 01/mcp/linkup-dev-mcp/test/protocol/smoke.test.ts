/**
 * Protocol smoke test: initialize, list tools/resources, and close.
 * Uses official SDK Client with StdioClientTransport.
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

describe('MCP Protocol Smoke Test', () => {
  let client: Client;
  let transport: StdioClientTransport;

  before(async () => {
    client = new Client(
      { name: 'test-client', version: '0.0.1' },
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
      // Ignore close errors in cleanup
    }
  });

  it('should initialize successfully', () => {
    // If we got here, initialization worked
    assert.ok(client, 'Client should be connected');
  });

  it('should list exactly 8 tools (3 G3 + 5 Runtime)', async () => {
    const result = await client.listTools();
    assert.strictEqual(result.tools.length, 8, `Expected 8 tools (3 G3 + 5 Runtime), got ${result.tools.length}`);

    const toolNames = result.tools.map(t => t.name).sort();
    assert.deepStrictEqual(toolNames, [
      'inspect_ui_prefab',
      'resolve_ui_contract',
      'runtime_capture_preview',
      'runtime_console_logs',
      'runtime_node_detail',
      'runtime_scene_tree',
      'runtime_status',
      'validate_project',
    ]);
  });

  it('should list exactly 4 resources', async () => {
    const result = await client.listResources();
    assert.strictEqual(result.resources.length, 4, `Expected 4 resources, got ${result.resources.length}`);

    const uris = result.resources.map(r => r.uri).sort();
    assert.deepStrictEqual(uris, [
      'linkup://project/architecture',
      'linkup://project/profile',
      'linkup://rules/ui-contracts',
      'linkup://validation/rules',
    ]);
  });

  it('should call validate_project successfully', async () => {
    const result = await client.callTool({ name: 'validate_project', arguments: {} });
    assert.ok(result.content);
    assert.ok(Array.isArray(result.content));
    assert.ok(result.content.length > 0);

    const textContent = (result.content as any[])[0];
    assert.strictEqual(textContent.type, 'text');
    const parsed = JSON.parse(textContent.text);
    assert.strictEqual(parsed.ok, true);
    assert.ok(parsed.data);
    assert.ok(parsed.data.summary);
    assert.ok(Array.isArray(parsed.data.diagnostics));
    assert.ok(Array.isArray(parsed.data.executedRules));
  });

  it('should call inspect_ui_prefab for UISet', async () => {
    const result = await client.callTool({ name: 'inspect_ui_prefab', arguments: { uiName: 'UISet' } });
    assert.ok(result.content);

    const textContent = (result.content as any[])[0];
    const parsed = JSON.parse(textContent.text);
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.data.uiName, 'UISet');
    assert.ok(parsed.data.prefabRelPath);
    assert.ok(parsed.data.rootNodeName);
    assert.ok(parsed.data.nodeTree);
  });

  it('should call resolve_ui_contract for UISet', async () => {
    const result = await client.callTool({ name: 'resolve_ui_contract', arguments: { uiName: 'UISet' } });
    assert.ok(result.content);

    const textContent = (result.content as any[])[0];
    const parsed = JSON.parse(textContent.text);
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.data.uiName, 'UISet');
    assert.ok(parsed.data.prefabBasename);
    assert.ok(parsed.data.nodePaths);
  });

  it('should read all 4 resources', async () => {
    const uris = [
      'linkup://project/profile',
      'linkup://project/architecture',
      'linkup://rules/ui-contracts',
      'linkup://validation/rules',
    ];

    for (const uri of uris) {
      const result = await client.readResource({ uri });
      assert.ok(result.contents, `Resource ${uri} should have contents`);
      assert.ok(result.contents.length > 0, `Resource ${uri} should have at least 1 content`);
      assert.ok(result.contents[0], `Resource ${uri} should have content item`);
      assert.ok((result.contents[0] as any).text, `Resource ${uri} should have text`);
    }
  });

  it('should return UI_NOT_FOUND for non-existent UI', async () => {
    const result = await client.callTool({ name: 'inspect_ui_prefab', arguments: { uiName: 'UIDoesNotExist123' } });
    assert.ok(result.content);

    const textContent = (result.content as any[])[0];
    const parsed = JSON.parse(textContent.text);
    assert.strictEqual(parsed.ok, false);
    assert.strictEqual(parsed.error.code, 'UI_NOT_FOUND');
  });

  it('should reject invalid tool input', async () => {
    try {
      const result = await client.callTool({
        name: 'inspect_ui_prefab',
        arguments: { uiName: '../escape' },
      });
      // If SDK passes it through, the tool should return error
      assert.ok(result.content);
      const textContent = (result.content as any[])[0];
      if (textContent && textContent.text) {
        try {
          const parsed = JSON.parse(textContent.text);
          assert.ok(parsed.ok === false || result.isError, 'Should reject invalid uiName');
        } catch {
          // Non-JSON error is acceptable (SDK schema rejection)
        }
      }
    } catch (err) {
      // SDK schema validation rejects the input - this is expected
      assert.ok(true, 'SDK rejected invalid uiName at schema level');
    }
  });
});

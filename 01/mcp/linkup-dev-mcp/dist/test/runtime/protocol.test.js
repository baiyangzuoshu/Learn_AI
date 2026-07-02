/**
 * Protocol test: Runtime tools always appear in tools/list and use ensureConnected.
 * Tests G4-01 (disconnected fast) and verifies connect() is attempted.
 *
 * Uses the official MCP SDK Client for reliable JSON-RPC communication.
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
describe('G4 Protocol: Runtime tools visibility & connection', () => {
    let client;
    let transport;
    before(async () => {
        client = new Client({ name: 'g4-test-client', version: '0.0.1' }, { capabilities: {} });
        transport = new StdioClientTransport({
            command: 'node',
            args: [SERVER_JS],
        });
        await client.connect(transport);
    });
    after(async () => {
        try {
            await client.close();
        }
        catch { /* ignore */ }
    });
    it('tools/list should always contain all 8 tools (3 G3 + 5 Runtime)', async () => {
        const result = await client.listTools();
        const toolNames = result.tools.map(t => t.name).sort();
        assert.ok(toolNames.includes('validate_project'), 'should include validate_project');
        assert.ok(toolNames.includes('inspect_ui_prefab'), 'should include inspect_ui_prefab');
        assert.ok(toolNames.includes('resolve_ui_contract'), 'should include resolve_ui_contract');
        assert.ok(toolNames.includes('runtime_status'), 'should include runtime_status');
        assert.ok(toolNames.includes('runtime_scene_tree'), 'should include runtime_scene_tree');
        assert.ok(toolNames.includes('runtime_node_detail'), 'should include runtime_node_detail');
        assert.ok(toolNames.includes('runtime_console_logs'), 'should include runtime_console_logs');
        assert.ok(toolNames.includes('runtime_capture_preview'), 'should include runtime_capture_preview');
        assert.equal(toolNames.length, 8, `should have exactly 8 tools, got ${toolNames.length}`);
    });
    it('runtime_status should attempt connection and return disconnected (G4-01)', async () => {
        const start = Date.now();
        const result = await client.callTool({
            name: 'runtime_status',
            arguments: {},
        });
        const elapsed = Date.now() - start;
        assert.ok(result.content, 'should have content');
        const textContent = result.content[0];
        const content = JSON.parse(textContent.text);
        assert.equal(content.ok, true, 'runtime_status should always return ok:true');
        assert.equal(content.data.status, 'disconnected', 'should be disconnected when no preview');
        assert.ok(content.data.error, 'should include error message explaining how to connect');
        // G4-01: must return within 2 seconds
        assert.ok(elapsed < 2000, `G4-01: must return within 2s, took ${elapsed}ms`);
    });
    it('runtime_status should try connecting to CDP (not just check cached state)', async () => {
        // Call runtime_status twice. Both should attempt connection.
        // The second call should also attempt (not cache disconnected state forever).
        const result1 = await client.callTool({ name: 'runtime_status', arguments: {} });
        const content1 = JSON.parse(result1.content[0].text);
        assert.equal(content1.data.status, 'disconnected');
        const result2 = await client.callTool({ name: 'runtime_status', arguments: {} });
        const content2 = JSON.parse(result2.content[0].text);
        assert.equal(content2.data.status, 'disconnected');
        // Both should have real error messages (not empty/null)
        assert.ok(content2.data.error.length > 0, 'should have descriptive error');
    });
    it('runtime_scene_tree should attempt connection then return RUNTIME_UNAVAILABLE', async () => {
        const result = await client.callTool({
            name: 'runtime_scene_tree',
            arguments: {},
        });
        const content = JSON.parse(result.content[0].text);
        assert.equal(content.ok, false, 'should return ok:false when no preview');
        assert.equal(content.error.code, 'RUNTIME_UNAVAILABLE');
        assert.ok(content.error.message.length > 0, 'should have descriptive error');
    });
    it('runtime_node_detail should attempt connection then return RUNTIME_UNAVAILABLE', async () => {
        const result = await client.callTool({
            name: 'runtime_node_detail',
            arguments: { nodePath: 'Canvas' },
        });
        const content = JSON.parse(result.content[0].text);
        assert.equal(content.ok, false);
        assert.equal(content.error.code, 'RUNTIME_UNAVAILABLE');
    });
    it('runtime_console_logs should attempt connection then return RUNTIME_UNAVAILABLE', async () => {
        const result = await client.callTool({
            name: 'runtime_console_logs',
            arguments: {},
        });
        const content = JSON.parse(result.content[0].text);
        assert.equal(content.ok, false);
        assert.equal(content.error.code, 'RUNTIME_UNAVAILABLE');
    });
    it('runtime_capture_preview should attempt connection then return RUNTIME_UNAVAILABLE', async () => {
        const result = await client.callTool({
            name: 'runtime_capture_preview',
            arguments: {},
        });
        const content = JSON.parse(result.content[0].text);
        assert.equal(content.ok, false);
        assert.equal(content.error.code, 'RUNTIME_UNAVAILABLE');
    });
    it('runtime_status connection attempt should not block G3 tools', async () => {
        // G3 tools should still work normally regardless of Runtime state
        const start = Date.now();
        const result = await client.callTool({
            name: 'validate_project',
            arguments: {},
        });
        const elapsed = Date.now() - start;
        const content = JSON.parse(result.content[0].text);
        assert.equal(content.ok, true, 'validate_project should still work');
        assert.ok(elapsed < 5000, `G3 tool should not be blocked by Runtime, took ${elapsed}ms`);
    });
});
//# sourceMappingURL=protocol.test.js.map
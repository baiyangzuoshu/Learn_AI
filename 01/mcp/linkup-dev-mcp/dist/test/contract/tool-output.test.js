/**
 * Contract tests: verify tool output matches expected schema structure.
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
describe('Contract: Tool Output', () => {
    let client;
    let transport;
    before(async () => {
        client = new Client({ name: 'contract-test', version: '0.0.1' }, { capabilities: {} });
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
        catch {
            // Ignore
        }
    });
    it('validate_project should return ToolEnvelope with ok=true', async () => {
        const result = await client.callTool({ name: 'validate_project', arguments: {} });
        assert.ok(result.content);
        const textContent = result.content[0];
        const parsed = JSON.parse(textContent.text);
        // Check envelope structure
        assert.strictEqual(typeof parsed.ok, 'boolean');
        assert.strictEqual(typeof parsed.meta, 'object');
        assert.strictEqual(typeof parsed.meta.serverVersion, 'string');
        assert.strictEqual(typeof parsed.meta.generatedAt, 'string');
        assert.strictEqual(typeof parsed.meta.truncated, 'boolean');
        // Check data structure
        assert.ok(Array.isArray(parsed.data.diagnostics));
        assert.strictEqual(typeof parsed.data.summary.errors, 'number');
        assert.strictEqual(typeof parsed.data.summary.warnings, 'number');
        assert.strictEqual(typeof parsed.data.summary.infos, 'number');
        assert.strictEqual(typeof parsed.data.summary.returnedDiagnostics, 'number');
        assert.strictEqual(typeof parsed.data.summary.totalDiagnostics, 'number');
        assert.ok(Array.isArray(parsed.data.executedRules));
    });
    it('inspect_ui_prefab should return ToolEnvelope with node tree', async () => {
        const result = await client.callTool({ name: 'inspect_ui_prefab', arguments: { uiName: 'UISet' } });
        assert.ok(result.content);
        const textContent = result.content[0];
        const parsed = JSON.parse(textContent.text);
        assert.strictEqual(parsed.ok, true);
        assert.strictEqual(typeof parsed.data.uiName, 'string');
        assert.strictEqual(typeof parsed.data.prefabRelPath, 'string');
        assert.strictEqual(typeof parsed.data.rootNodeName, 'string');
        assert.strictEqual(typeof parsed.data.registrationStatus, 'string');
        assert.ok(['global', 'local', 'unregistered', 'ambiguous'].includes(parsed.data.registrationStatus));
        assert.strictEqual(typeof parsed.data.nodeCount, 'number');
        assert.strictEqual(typeof parsed.data.returnedNodeCount, 'number');
        assert.ok(parsed.data.nodeTree);
        assert.ok(Array.isArray(parsed.data.diagnostics));
    });
    it('resolve_ui_contract should return contract data', async () => {
        const result = await client.callTool({ name: 'resolve_ui_contract', arguments: { uiName: 'UISet' } });
        assert.ok(result.content);
        const textContent = result.content[0];
        const parsed = JSON.parse(textContent.text);
        assert.strictEqual(parsed.ok, true);
        assert.strictEqual(typeof parsed.data.uiName, 'string');
        assert.strictEqual(typeof parsed.data.prefabBasename, 'string');
        assert.strictEqual(typeof parsed.data.prefabRelPath, 'string');
        assert.strictEqual(typeof parsed.data.rootNodeName, 'string');
        assert.ok(Array.isArray(parsed.data.nodePaths));
        assert.ok(['complete', 'incomplete', 'ambiguous', 'not_found'].includes(parsed.data.status));
        assert.ok(Array.isArray(parsed.data.diagnostics));
    });
    it('UI_NOT_FOUND should return ok=false with error.code', async () => {
        const result = await client.callTool({
            name: 'inspect_ui_prefab',
            arguments: { uiName: 'UIDoesNotExist999' },
        });
        assert.ok(result.content);
        const textContent = result.content[0];
        const parsed = JSON.parse(textContent.text);
        assert.strictEqual(parsed.ok, false);
        assert.strictEqual(parsed.error.code, 'UI_NOT_FOUND');
        assert.strictEqual(typeof parsed.error.message, 'string');
        assert.ok(parsed.meta);
    });
    it('resolve_ui_contract for non-existent UI should return not_found', async () => {
        const result = await client.callTool({
            name: 'resolve_ui_contract',
            arguments: { uiName: 'UIDoesNotExist999' },
        });
        assert.ok(result.content);
        const textContent = result.content[0];
        const parsed = JSON.parse(textContent.text);
        assert.strictEqual(parsed.ok, false);
        assert.strictEqual(parsed.error.code, 'UI_NOT_FOUND');
    });
});
//# sourceMappingURL=tool-output.test.js.map
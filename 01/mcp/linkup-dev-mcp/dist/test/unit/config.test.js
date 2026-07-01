/**
 * Unit tests for config loading.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadConfig } from '../../src/config.js';
describe('Config', () => {
    it('should load the fixed config successfully', () => {
        const result = loadConfig();
        assert.ok(result.config, 'Should have config');
        assert.ok(!result.error, 'Should not have error');
        assert.ok(result.config.projectRoot, 'Should have projectRoot');
        assert.ok(result.config.baselinePath, 'Should have baselinePath');
        assert.strictEqual(result.config.maxTreeDepth, 8);
        assert.strictEqual(result.config.maxTreeNodes, 2000);
        assert.strictEqual(result.config.maxDiagnostics, 500);
        assert.strictEqual(result.config.logLevel, 'info');
    });
    it('should have resolved project root as absolute path', () => {
        const result = loadConfig();
        assert.ok(result.config.projectRoot.startsWith('/'), 'projectRoot should be absolute');
    });
});
//# sourceMappingURL=config.test.js.map
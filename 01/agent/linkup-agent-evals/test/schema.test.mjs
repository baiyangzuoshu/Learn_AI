import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCENARIOS_DIR = join(ROOT, 'scenarios');
const SCHEMAS_DIR = join(ROOT, 'schemas');

// Load schemas
const scenarioSchema = JSON.parse(readFileSync(join(SCHEMAS_DIR, 'scenario.schema.json'), 'utf-8'));
const resultSchema = JSON.parse(readFileSync(join(SCHEMAS_DIR, 'result.schema.json'), 'utf-8'));

// Load config
const config = JSON.parse(readFileSync(join(ROOT, 'scenario.config.json'), 'utf-8'));

describe('Scenario Schema Tests', () => {
  const scenarioFiles = readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.json'));

  test('all scenario files are valid JSON', () => {
    for (const file of scenarioFiles) {
      const content = readFileSync(join(SCENARIOS_DIR, file), 'utf-8');
      assert.doesNotThrow(() => JSON.parse(content), `${file} should be valid JSON`);
    }
  });

  test('all scenarios have required fields', () => {
    const required = ['id', 'title', 'version', 'enabled', 'phase', 'taskType', 'prompt', 'setup', 'permissions', 'assertions', 'scoring', 'timeoutSeconds', 'tags'];

    for (const file of scenarioFiles) {
      const scenario = JSON.parse(readFileSync(join(SCENARIOS_DIR, file), 'utf-8'));
      for (const field of required) {
        assert.ok(field in scenario, `${file} missing required field: ${field}`);
      }
    }
  });

  test('all scenario IDs are unique', () => {
    const ids = new Set();
    for (const file of scenarioFiles) {
      const scenario = JSON.parse(readFileSync(join(SCENARIOS_DIR, file), 'utf-8'));
      assert.ok(!ids.has(scenario.id), `Duplicate ID: ${scenario.id}`);
      ids.add(scenario.id);
    }
  });

  test('all scenario IDs match pattern E001-E999 or G6-S0x', () => {
    for (const file of scenarioFiles) {
      const scenario = JSON.parse(readFileSync(join(SCENARIOS_DIR, file), 'utf-8'));
      assert.ok(/^(E[0-9]{3}|G6-S0[0-9])$/.test(scenario.id), `${file}: Invalid ID format '${scenario.id}'`);
    }
  });

  test('all weights sum to 100', () => {
    for (const file of scenarioFiles) {
      const scenario = JSON.parse(readFileSync(join(SCENARIOS_DIR, file), 'utf-8'));
      const { safety, correctness, workflow, evidence, efficiency } = scenario.scoring.weights;
      const sum = (safety || 0) + (correctness || 0) + (workflow || 0) + (evidence || 0) + (efficiency || 0);
      assert.strictEqual(sum, 100, `${file}: Weights sum to ${sum}`);
    }
  });

  test('Runtime scenarios have capability gate', () => {
    for (const file of scenarioFiles) {
      const scenario = JSON.parse(readFileSync(join(SCENARIOS_DIR, file), 'utf-8'));
      if (scenario.taskType === 'runtime') {
        assert.ok(
          scenario.setup.requiredCapabilities?.includes('runtime'),
          `${file}: Runtime scenario missing 'runtime' capability`
        );
      }
    }
  });

  test('path conflicts detected', () => {
    for (const file of scenarioFiles) {
      const scenario = JSON.parse(readFileSync(join(SCENARIOS_DIR, file), 'utf-8'));
      const { allowedWritePaths, forbiddenPaths } = scenario.permissions;

      for (const writePath of (allowedWritePaths || [])) {
        for (const forbidden of (forbiddenPaths || [])) {
          // Simple check - could be more sophisticated
          const writeBase = writePath.replace('**', '');
          const forbiddenBase = forbidden.replace('**', '');

          // Allow if one is a subpath of the other (not a conflict)
          // Conflict only if they overlap in a problematic way
          // For now, just log potential conflicts
          if (writeBase.startsWith(forbiddenBase) || forbiddenBase.startsWith(writeBase)) {
            console.log(`  Potential path conflict in ${file}: ${writePath} vs ${forbidden}`);
          }
        }
      }
    }
  });
});

describe('Result Schema Tests', () => {
  test('result schema has required fields', () => {
    const required = ['scenarioId', 'runId', 'startedAt', 'finishedAt', 'agentHost', 'status', 'observedFacts', 'toolCalls', 'commands', 'fileChanges', 'claims', 'assertions', 'scores', 'hardFailures', 'notes'];

    // Just verify the schema has these properties defined
    for (const field of required) {
      assert.ok(field in resultSchema.properties, `Result schema missing field: ${field}`);
    }
  });

  test('result schema status enum is correct', () => {
    const statusEnum = resultSchema.properties.status.enum;
    assert.deepStrictEqual(statusEnum, ['completed', 'failed', 'blocked', 'cancelled']);
  });
});

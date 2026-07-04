#!/usr/bin/env node

/**
 * summarize-runs.mjs
 * Summarizes all run results for a scenario or set of scenarios.
 * Outputs per-scenario status, dimension scores, hard failures, and overall pass rate.
 * Does NOT output "system PASS" - that is for independent verifier.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT_BASE = '/tmp/linkup-agent-evals';

/**
 * Load all results for a scenario
 */
function loadResults(scenarioId) {
  const scenarioDir = join(OUTPUT_BASE, scenarioId);
  if (!existsSync(scenarioDir)) {
    return [];
  }

  const results = [];
  const runDirs = readdirSync(scenarioDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const runId of runDirs) {
    const resultPath = join(scenarioDir, runId, 'result.json');
    if (existsSync(resultPath)) {
      try {
        const result = JSON.parse(readFileSync(resultPath, 'utf-8'));
        results.push(result);
      } catch (e) {
        console.error(`Failed to load result for ${scenarioId}/${runId}: ${e.message}`);
      }
    }
  }

  return results;
}

/**
 * Calculate average scores across runs
 */
function averageScores(results) {
  if (results.length === 0) return null;

  const sums = { safety: 0, correctness: 0, workflow: 0, evidence: 0, efficiency: 0, total: 0 };
  for (const result of results) {
    if (result.scores) {
      sums.safety += result.scores.safety || 0;
      sums.correctness += result.scores.correctness || 0;
      sums.workflow += result.scores.workflow || 0;
      sums.evidence += result.scores.evidence || 0;
      sums.efficiency += result.scores.efficiency || 0;
      sums.total += result.scores.total || 0;
    }
  }

  return {
    safety: Math.round(sums.safety / results.length),
    correctness: Math.round(sums.correctness / results.length),
    workflow: Math.round(sums.workflow / results.length),
    evidence: Math.round(sums.evidence / results.length),
    efficiency: Math.round(sums.efficiency / results.length),
    total: Math.round(sums.total / results.length)
  };
}

/**
 * Main function
 */
function main() {
  const scenarioIds = process.argv.slice(2);

  // If no scenarios specified, find all
  let scenariosToSummarize = scenarioIds;
  if (scenariosToSummarize.length === 0) {
    scenariosToSummarize = readdirSync(join(ROOT, 'scenarios'))
      .filter(f => f.endsWith('.json'))
      .map(f => f.split('-')[0]);
  }

  console.log(`\n=== Run Summary ===`);
  console.log(`Scenarios: ${scenariosToSummarize.join(', ')}`);
  console.log('');

  const summary = {
    totalScenarios: scenariosToSummarize.length,
    passed: 0,
    failed: 0,
    blocked: 0,
    scenarios: []
  };

  for (const scenarioId of scenariosToSummarize) {
    const results = loadResults(scenarioId);
    const scores = averageScores(results);

    // Determine scenario status
    let status = 'no-runs';
    let hardFailures = [];

    if (results.length > 0) {
      const latest = results[results.length - 1];
      status = latest.status || 'unknown';
      hardFailures = latest.hardFailures || [];
    }

    // Update summary
    if (status === 'passed') summary.passed++;
    else if (status === 'failed') summary.failed++;
    else if (status === 'blocked') summary.blocked++;

    // Add to scenarios list
    summary.scenarios.push({
      id: scenarioId,
      status,
      runCount: results.length,
      scores,
      hardFailures
    });

    // Output scenario details
    console.log(`--- ${scenarioId} ---`);
    console.log(`  Status: ${status}`);
    console.log(`  Runs: ${results.length}`);

    if (scores) {
      console.log(`  Scores:`);
      console.log(`    Safety: ${scores.safety}/100`);
      console.log(`    Correctness: ${scores.correctness}/100`);
      console.log(`    Workflow: ${scores.workflow}/100`);
      console.log(`    Evidence: ${scores.evidence}/100`);
      console.log(`    Efficiency: ${scores.efficiency}/100`);
      console.log(`    TOTAL: ${scores.total}/100`);
    }

    if (hardFailures.length > 0) {
      console.log(`  Hard Failures:`);
      for (const fail of hardFailures) {
        console.log(`    - ${fail}`);
      }
    }

    console.log('');
  }

  // Output overall summary
  console.log(`=== Overall Summary ===`);
  console.log(`Total Scenarios: ${summary.totalScenarios}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Blocked: ${summary.blocked}`);
  console.log(`\nNote: Final PASS decision is for independent verifier only.`);

  return summary;
}

// Run
try {
  main();
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}

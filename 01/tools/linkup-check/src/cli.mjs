/**
 * CLI module for linkup-check.
 * Parses arguments and orchestrates check execution.
 */

import { runChecks, listRules } from './index.mjs';
import { formatText } from './reporters/text-reporter.mjs';
import { formatJSON } from './reporters/json-reporter.mjs';
import { existsSync } from 'node:fs';

/**
 * Parse CLI arguments into options.
 * @param {string[]} argv
 * @returns {{ project?: string, rules?: string[], format?: string, baseline?: string, help?: boolean, listRules?: boolean }}
 */
export function parseArgs(argv) {
  const args = argv.slice(2); // Skip node and script path
  const options = {
    project: undefined,
    rules: [],
    format: 'text',
    baseline: undefined,
    help: false,
    listRules: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;

      case '--project':
      case '-p':
        options.project = args[++i];
        break;

      case '--rule':
      case '-r':
        options.rules.push(args[++i]);
        break;

      case '--format':
      case '-f':
        options.format = args[++i];
        break;

      case '--baseline':
      case '-b':
        options.baseline = args[++i];
        break;

      case '--list-rules':
        options.listRules = true;
        break;

      default:
        // Unknown argument
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(2);
        }
        // If no project specified yet, treat as project path
        if (!options.project) {
          options.project = arg;
        }
        break;
    }
  }

  return options;
}

/**
 * Print help text.
 */
export function printHelp() {
  console.log(`
linkup-check - Deterministic static checker for LinkUpClient

Usage:
  linkup-check [options] [project-path]

Options:
  --project, -p <path>    LinkUpClient project root directory
  --rule, -r <id>         Run only specified rule (can be repeated)
  --format, -f <fmt>      Output format: text (default) or json
  --baseline, -b <path>   Path to baseline JSON file
  --list-rules            List all available rules and exit
  --help, -h              Show this help message

Exit Codes:
  0   No unbaselined errors found
  1   Rule errors detected
  2   Configuration, path, or tool error

Examples:
  linkup-check --project ./LinkUpClient
  linkup-check -p ./LinkUpClient -r ui/prefab-root-name -f json
  linkup-check -p ./LinkUpClient -b ./baseline.json
`);
}

/**
 * Run the CLI.
 * @param {string[]} argv
 * @returns {Promise<number>} Exit code
 */
export async function runCLI(argv) {
  const options = parseArgs(argv);

  if (options.help) {
    printHelp();
    return 0;
  }

  if (options.listRules) {
    const rules = listRules();
    console.log('Available rules:');
    for (const rule of rules) {
      console.log(`  ${rule}`);
    }
    return 0;
  }

  // Validate project path
  if (!options.project) {
    console.error('Error: --project is required. Use --help for usage information.');
    return 2;
  }

  if (!existsSync(options.project)) {
    console.error(`Error: Project directory not found: ${options.project}`);
    return 2;
  }

  // Validate format
  if (!['text', 'json'].includes(options.format)) {
    console.error(`Error: Invalid format "${options.format}". Use "text" or "json".`);
    return 2;
  }

  // Validate rule IDs early
  if (options.rules.length > 0) {
    const available = listRules();
    for (const r of options.rules) {
      if (!available.includes(r)) {
        console.error(`Error: Unknown rule "${r}". Available: ${available.join(', ')}`);
        return 2;
      }
    }
  }

  try {
    const result = await runChecks({
      projectRoot: options.project,
      ruleIds: options.rules.length > 0 ? options.rules : undefined,
      baselinePath: options.baseline,
    });

    // Output
    const output = options.format === 'json'
      ? formatJSON(result)
      : formatText(result);

    console.log(output);

    // Exit code: 1 if there are unbaselined errors
    if (result.summary.errors > 0) {
      return 1;
    }

    return 0;
  } catch (e) {
    console.error(`Error: ${e.message}`);
    return 2;
  }
}

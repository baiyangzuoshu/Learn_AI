/**
 * Configuration loading and resolution for linkup-check.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Default configuration values.
 */
const DEFAULTS = {
  projectRoot: '../LinkUpClient',
  rules: {
    prefabGlob: 'assets/BundleLLK/GUI/*.prefab',
    tsControllerGlob: 'assets/Scripts/UI/*UICtrl.ts',
    constantPath: 'assets/Scripts/Constant.ts',
    uiControllerPath: 'assets/Scripts/Manager/UIController.ts',
    scriptGlob: 'assets/Scripts/**/*.ts',
  },
  baselinePath: null,
};

/**
 * Load and merge configuration.
 * Priority: CLI args > config file > defaults.
 */
export function loadConfig(cliArgs = {}) {
  const configDir = resolve(__dirname, '..');

  // Try to load config file
  let fileConfig = {};
  const configPath = resolve(configDir, 'linkup-check.config.json');
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch {
      // Config file is optional; ignore parse errors
    }
  }

  // Resolve projectRoot
  // CLI args are relative to CWD; config file args are relative to config dir
  let projectRoot = cliArgs.project || fileConfig.projectRoot || DEFAULTS.projectRoot;
  if (cliArgs.project) {
    // CLI args: resolve from CWD
    projectRoot = resolve(process.cwd(), projectRoot);
  } else {
    // Config file: resolve from config dir
    projectRoot = resolve(configDir, projectRoot);
  }

  // Resolve baseline path
  let baselinePath = cliArgs.baseline || fileConfig.baselinePath || DEFAULTS.baselinePath;
  if (baselinePath) {
    if (cliArgs.baseline) {
      baselinePath = resolve(process.cwd(), baselinePath);
    } else {
      baselinePath = resolve(configDir, baselinePath);
    }
  }

  // Merge rule paths
  const ruleConfig = { ...DEFAULTS.rules };
  if (fileConfig.rules) {
    if (fileConfig.rules.prefabGlob) ruleConfig.prefabGlob = fileConfig.rules.prefabGlob;
    if (fileConfig.rules.tsControllerGlob) ruleConfig.tsControllerGlob = fileConfig.rules.tsControllerGlob;
    if (fileConfig.rules.constantPath) ruleConfig.constantPath = fileConfig.rules.constantPath;
    if (fileConfig.rules.uiControllerPath) ruleConfig.uiControllerPath = fileConfig.rules.uiControllerPath;
    if (fileConfig.rules.scriptGlob) ruleConfig.scriptGlob = fileConfig.rules.scriptGlob;
  }

  return {
    projectRoot,
    baselinePath,
    rules: ruleConfig,
    format: cliArgs.format || 'text',
    ruleFilter: cliArgs.rules || null,
  };
}

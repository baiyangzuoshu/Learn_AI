#!/usr/bin/env node

/**
 * linkup-check CLI entry point.
 */

import { runCLI } from '../src/cli.mjs';

const exitCode = await runCLI(process.argv);
process.exit(exitCode);

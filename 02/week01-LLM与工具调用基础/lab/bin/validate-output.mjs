#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgainstSchema } from '../src/schema-validator.mjs';

const inputArgument = process.argv[2];

if (!inputArgument) {
  console.error('Usage: node bin/validate-output.mjs <result.json>');
  process.exitCode = 2;
} else {
  try {
    const schemaPath = fileURLToPath(new URL('../schema/risk-assessment.schema.json', import.meta.url));
    const inputPath = resolve(process.cwd(), inputArgument);
    const [schemaText, inputText] = await Promise.all([
      readFile(schemaPath, 'utf8'),
      readFile(inputPath, 'utf8'),
    ]);

    const schema = JSON.parse(schemaText);
    const value = JSON.parse(inputText);
    const errors = validateAgainstSchema(value, schema);
    const report = {
      valid: errors.length === 0,
      file: inputPath,
      errorCount: errors.length,
      errors,
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.valid ? 0 : 1;
  } catch (error) {
    const report = {
      valid: false,
      file: resolve(process.cwd(), inputArgument),
      errorCount: 1,
      errors: [{
        path: '$',
        keyword: 'parse-or-read',
        message: error instanceof Error ? error.message : String(error),
      }],
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 2;
  }
}

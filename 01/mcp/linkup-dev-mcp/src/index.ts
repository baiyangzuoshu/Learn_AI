/**
 * linkup-dev-mcp entry point.
 * Starts the MCP server on stdio transport.
 */

import { createAndStartServer } from './server.js';

async function main() {
  try {
    await createAndStartServer();
  } catch (err) {
    process.stderr.write(`FATAL: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

main();

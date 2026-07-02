/**
 * linkup-dev-mcp entry point.
 * Starts the MCP server on stdio transport.
 */

import { createAndStartServer } from './server.js';

async function main() {
  try {
    const { cdpManager } = await createAndStartServer();

    // Graceful shutdown: disconnect CDP when stdin closes
    process.stdin.on('end', async () => {
      try {
        await cdpManager.disconnect();
      } catch { /* ignore cleanup errors */ }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      try {
        await cdpManager.disconnect();
      } catch { /* ignore */ }
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      try {
        await cdpManager.disconnect();
      } catch { /* ignore */ }
      process.exit(0);
    });

  } catch (err) {
    process.stderr.write(`FATAL: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

main();

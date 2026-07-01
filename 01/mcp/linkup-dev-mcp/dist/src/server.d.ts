/**
 * MCP Server setup - uses low-level Server API for full capability control.
 * Does NOT use McpServer (which auto-injects listChanged: true).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
export declare function createAndStartServer(): Promise<{
    server: Server;
    transport: StdioServerTransport;
}>;
//# sourceMappingURL=server.d.ts.map
# ADR-MCP-001: MCP SDK and Protocol Selection

## Status

Accepted

## Date

2026-07-01

## Context

G3 requires implementing a stdio MCP Server for LinkUpClient static analysis. We need to choose an MCP SDK version and protocol baseline.

## Decision

### Protocol Version

- **MCP Specification**: `2025-11-25` (current stable)
- **Transport**: stdio only (StdioServerTransport)
- **stdout**: MCP JSON-RPC messages only; all logging via stderr

### SDK Selection

- **Package**: `@modelcontextprotocol/sdk` version `1.29.0` (exact, no `^`/`~`/`latest`)
- **Major version**: v1.x (stable)
- **v2 alpha excluded**: `@modelcontextprotocol/server@2.*-alpha` is not production-ready per official guidance

### Why v1, not v2 alpha

1. Official TypeScript SDK repository states v2 is alpha and recommends v1.x for production.
2. v1.29.0 is the current `latest` dist-tag on npm.
3. v1 provides `McpServer`, `StdioServerTransport`, and the official Client for testing — all sufficient for G3's read-only stdio scope.
4. v2 alpha introduces breaking API changes and HTTP-first transport that are unnecessary for G3.

### Dependencies

| Package | Version | Role |
|---|---|---|
| `@modelcontextprotocol/sdk` | `1.29.0` (exact) | MCP Server/Client framework |
| `zod` | `3.25.76` (exact) | Schema validation (SDK peer dependency) |
| `linkup-check` | `file:../../tools/linkup-check` | G1 static analysis library |
| `typescript` | `5.8.3` (dev) | Type checking |
| `@types/node` | `22.15.0` (dev) | Node.js type definitions |

### Node.js Runtime

- **Required**: `>=18`
- **Current environment**: `v22.22.2`
- **npm**: `10.9.7`

### Conformance

- `initialize` capability negotiation handled by SDK; no manual protocol version fabrication.
- Server declares only `tools` and `resources` capabilities.
- No `prompts`, `sampling`, `elicitation`, `tasks`, `subscriptions`, or `listChanged`.

## Consequences

- SDK's runtime dependencies (express, hono, etc.) are installed but never used — G3 only uses stdio transport.
- Exact version pinning ensures reproducible builds via `npm ci`.
- Future SDK upgrades require explicit ADR update and re-validation.

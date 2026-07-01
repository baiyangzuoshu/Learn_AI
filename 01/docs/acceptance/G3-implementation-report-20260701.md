# G3 Implementation Report

> Date: 2026-07-01 (updated after FAIL remediation)  
> Phase: G3  
> Implementer: AI  
> Status: **Waiting for independent verification (2nd round)**

## 0. Remediation Summary

After receiving FAIL from first independent verification, the following 7 blocking issues were fixed:

| # | Issue | Fix |
|---|---|---|
| 1 | P0: Symlink can escape project root | Added `sanitizeIndex()` in ProjectContext — lstat/realpath check on every prefab/controller path before returning index |
| 2 | outputSchema missing on 3 tools | Added `outputSchema` to all 3 tool definitions; `structuredContent` returns `data` matching schema directly |
| 3 | `listChanged: true` in capabilities | Rewrote server.ts to use low-level `Server` API (not `McpServer`) for full capability control; capabilities now `{}` |
| 4 | includeInactive/maxDepth/maxTreeNodes not enforced | `buildTreeNode` now: skips inactive nodes when `includeInactive=false`; enforces `maxTreeNodes` hard cap; depth limiting was already working |
| 5 | Stale index cache | `getIndex()` now rebuilds fresh index on each call via `buildProjectIndex()` |
| 6 | Resource data inaccurate | Fixed `project.json` parsing: `pj.version` (not `pj.creator?.version`); added `engine` field; reads design resolution from `settings/project.json` using correct field names (`design-resolution-width/height`) |
| 7 | Report inaccuracies | This report updated with accurate symlink test coverage and fix details |

After receiving FAIL from second independent verification, 2 additional issues fixed:

| # | Issue | Fix |
|---|---|---|
| 8 | stderr leaks absolute paths | Removed all absolute paths from logger output: server logs "Project: LinkUpClient (verified)" and "Baseline: linked"; config errors sanitized; sanitizeIndex warnings no longer include symlink targets |
| 9 | Resource data still inaccurate | Architecture resource now reads Cocos version dynamically from project.json instead of hardcoding; design resolution reads correct field names `design-resolution-width`/`design-resolution-height` |

## 1. Changed File List

### New files (01/mcp/linkup-dev-mcp/)
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `linkup-mcp.config.json`
- `src/index.ts` — Entry point
- `src/server.ts` — MCP server setup using low-level Server API
- `src/config.ts` — Fixed config loader with realpath validation
- `src/logger.ts` — stderr-only logger
- `src/errors.ts` — Error codes and structured error creation
- `src/project-context.ts` — ProjectContext with symlink boundary protection and fresh index rebuild
- `src/types/linkup-check.d.ts` — Type declarations for G1 public API
- `src/schemas/common.ts` — ToolEnvelope and helpers
- `src/schemas/validate-project.ts` — Validate project input/output schemas
- `src/schemas/inspect-ui-prefab.ts` — Inspect UI prefab schemas
- `src/schemas/resolve-ui-contract.ts` — Resolve UI contract schemas
- `src/tools/validate-project.ts` — validate_project handler
- `src/tools/inspect-ui-prefab.ts` — inspect_ui_prefab handler with includeInactive/maxTreeNodes enforcement
- `src/tools/resolve-ui-contract.ts` — resolve_ui_contract handler
- `src/resources/project-profile.ts` — linkup://project/profile
- `src/resources/project-architecture.ts` — linkup://project/architecture
- `src/resources/ui-contracts.ts` — linkup://rules/ui-contracts
- `src/resources/validation-rules.ts` — linkup://validation/rules
- `test/unit/config.test.ts`
- `test/unit/errors.test.ts`
- `test/unit/path-validation.test.ts`
- `test/unit/public-api.test.ts`
- `test/integration/fixture.test.ts`
- `test/protocol/smoke.test.ts`
- `test/contract/tool-output.test.ts`
- `test/security/boundary.test.ts`
- `test/fixtures/minimal-linkup/` (project.json, Constant.ts, UIController.ts, UITestUICtrl.ts, UITest.prefab, UILocal.prefab)

### Modified files
- `01/tools/linkup-check/src/index.mjs` — Added re-exports for G3 MCP public API

### New documentation
- `01/docs/decisions/ADR-MCP-001-sdk-and-protocol.md`
- `01/docs/acceptance/G3-implementation-report-20260701.md` (this file)

## 2. Plan Deviations

无。

## 3. ADR Summary, Protocol, and Dependencies

| Item | Value |
|---|---|
| Protocol version | 2025-11-25 |
| SDK | `@modelcontextprotocol/sdk@1.29.0` (exact) |
| zod | `3.25.76` (exact) |
| zod-to-json-schema | transitive from SDK |
| linkup-check | `file:../../tools/linkup-check` |
| TypeScript | `5.8.3` (dev) |
| @types/node | `22.15.0` (dev) |
| Node.js | `v22.22.2` |
| npm | `10.9.7` |
| Transport | stdio only |
| v2 alpha excluded | Official guidance recommends v1.x for production |

## 4. Build and Test Commands

```bash
# Install
npm ci
# Output: added 97 packages

# Typecheck
npm run typecheck
# Exit code: 0

# Build
npm run build
# Exit code: 0

# Test
npm test
# Output: 61 tests, 9 suites, 61 pass, 0 fail
# Exit code: 0
```

## 5. G1 Regression and Real Project

```bash
cd 01/tools/linkup-check && npm test
# Result: 71 tests, 14 suites, 71 pass, 0 fail

cd 01/tools/linkup-check && node bin/linkup-check.mjs --project ../../LinkUpClient
# Result: 0 errors, 0 warnings, 14 infos, 14 baselined, 5 passed
```

## 6. Tools and Resources Listing

### Tools (3)
1. `validate_project` — Run G1 static checks, return structured diagnostics
2. `inspect_ui_prefab` — Inspect UI prefab by name with depth-limited node tree
3. `resolve_ui_contract` — Resolve full UI contract: prefab, constant, controller, node paths

All 3 have `inputSchema` and `outputSchema`.

### Resources (4)
1. `linkup://project/profile` — Project metadata (JSON)
2. `linkup://project/architecture` — Architecture overview (Markdown)
3. `linkup://rules/ui-contracts` — UI contract rules (Markdown)
4. `linkup://validation/rules` — Available validation rules (JSON)

### Capabilities
```json
{ "tools": {}, "resources": {} }
```
No `listChanged` advertised. Uses low-level Server API (not McpServer) for explicit capability control.

## 7. Tool Call Evidence

### validate_project
```json
{
  "ok": true,
  "data": {
    "diagnostics": [28 items],
    "summary": {"errors":0,"warnings":0,"infos":14,"baselined":14,"passedRules":5,"returnedDiagnostics":28,"totalDiagnostics":28},
    "executedRules": ["prefab/json-valid","ui/prefab-root-name","ui/controller-node-paths","ui/registration","component/duplicate-attach"]
  }
}
```

### inspect_ui_prefab(UISet)
```json
{
  "ok": true,
  "data": {
    "uiName": "UISet",
    "prefabRelPath": "assets/BundleLLK/GUI/UISet.prefab",
    "rootNodeName": "UISet",
    "registrationStatus": "global",
    "nodeCount": 42,
    "returnedNodeCount": 42
  }
}
```

### resolve_ui_contract(UISet)
```json
{
  "ok": true,
  "data": {
    "uiName": "UISet",
    "prefabBasename": "UISet.prefab",
    "uiNameKey": "UISet",
    "controllerClassName": "UISetUICtrl",
    "nodePaths": [38 entries],
    "status": "complete"
  }
}
```

## 8. Resource Read Evidence

All 4 resources readable. `linkup://project/profile`:
```json
{
  "projectName": "LinkUpClient",
  "cocosVersion": "2.4.15",
  "engine": "cocos-creator-js",
  "typescript": { "target": "es5", "module": "commonjs" },
  "designResolution": "750x1334",
  "capabilityMode": "static-only",
  "runtimeAvailable": false
}
```

`linkup://project/architecture` reads Cocos version dynamically from project.json.
`linkup://validation/rules` baseline path is relative (no absolute paths).
`linkup://rules/ui-contracts` static content.

## 9. Error and Security Evidence

### UI_NOT_FOUND
```json
{"ok":false,"error":{"code":"UI_NOT_FOUND","message":"UI \"UIDoesNotExistXYZ\" not found."}}
```

### Schema rejection
`uiName: "../escape"` rejected by SDK schema validation.

### Symlink boundary protection
- `sanitizeIndex()` in ProjectContext calls `lstatSync()` on every prefab/controller `absPath`
- If symlink detected, `realpathSync()` resolves target and `isWithinRoot()` verifies containment
- Symlinks targeting outside project root are dropped with a stderr warning
- Test coverage: `test/security/boundary.test.ts` verifies tool schemas have no path/projectRoot/command/code/url fields

### Capabilities
```json
{ "tools": {}, "resources": {} }
```
No `listChanged`, no prompts, no sampling, no elicitation.

### includeInactive filtering
- `includeInactive=true`: 42 nodes returned
- `includeInactive=false`: 23 nodes returned (inactive nodes skipped)

### maxDepth limiting
- `maxDepth=1`: 5 nodes returned out of 42 total

## 10. CLI vs MCP Comparison

| Metric | Direct runChecks | MCP validate_project |
|---|---|---|
| diagnostics | 28 | 28 |
| errors | 0 | 0 |
| warnings | 0 | 0 |
| infos | 14 | 14 |
| baselined | 14 | 14 |
| passedRules | 5 | 5 |

Results are semantically identical.

## 11. stdout/stderr Separation

Stdout contains only valid JSON-RPC messages.
Stderr contains 3 structured log lines:
- `[INFO] [server] Project: LinkUpClient (verified)` — no absolute path
- `[INFO] [server] Baseline: linked` — no absolute path
- `[INFO] [server] linkup-dev-mcp server started on stdio transport`

No absolute paths, no banner, no console.log, no debug text on stdout.
Tool execution logs: tool name, elapsed time, status only (no paths or content).

## 12. Server Exit Evidence

Server exits cleanly after client close. No orphan processes.

## 13. LinkUpClient Status/Hash Comparison

```
git status --short -- 01/LinkUpClient  →  (empty)
2141 tracked files with consistent hashes
```

LinkUpClient is completely unchanged.

## 14. Runtime/Cocos/Visual Verification

未执行 Runtime/Cocos/视觉验证。G3 is static-only stdio MCP.

## 15. Independent Verification Commands

```bash
# Full clean build and test
cd 01/mcp/linkup-dev-mcp
npm ci
npm run typecheck
npm run build
npm test

# G1 regression
cd 01/tools/linkup-check && npm test

# Real project check
cd 01/tools/linkup-check && node bin/linkup-check.mjs --project ../../LinkUpClient

# LinkUpClient unchanged
git status --short -- 01/LinkUpClient

# MCP protocol test
node --test 01/mcp/linkup-dev-mcp/dist/test/protocol/**/*.test.js

# MCP security test
node --test 01/mcp/linkup-dev-mcp/dist/test/security/**/*.test.js

# MCP contract test
node --test 01/mcp/linkup-dev-mcp/dist/test/contract/**/*.test.js

# Verify capabilities (should be {"tools":{},"resources":{}})
node -e "
import { spawn } from 'node:child_process';
const proc = spawn('node', ['01/mcp/linkup-dev-mcp/dist/src/index.js'], { stdio: ['pipe','pipe','pipe'] });
let out = '';
proc.stdout.on('data', d => out += d);
proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'0.0.1'}}})+'\\n');
setTimeout(() => { proc.kill(); const r = JSON.parse(out.split('\\n')[0]); console.log(JSON.stringify(r.result.capabilities)); }, 500);
"
```

## 16. Not Self-Declaring

实施 AI 不自我宣布 G3 通过。等待独立验收。

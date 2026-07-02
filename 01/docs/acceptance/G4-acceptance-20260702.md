# G4 Independent Acceptance Record

> Date: 2026-07-02  
> Phase: G4 Runtime Adapter  
> Acceptance Role: Independent Acceptance AI  
> Status: PASS

## 1. Actual Files Checked

- `01/docs/linkup-ai-engineering-master-plan.md`
- `01/docs/linkup-mcp-implementation-plan.md`
- `01/docs/decisions/ADR-MCP-002-runtime-adapter.md`
- `01/docs/acceptance/G4.1-spike-report-20260701.md`
- `01/docs/acceptance/G4.2-implementation-report-20260702.md`
- `01/docs/acceptance/G4.2-fix-report-20260702.md`
- `01/mcp/linkup-dev-mcp/src/runtime/cdp-manager.ts`
- `01/mcp/linkup-dev-mcp/src/runtime/whitelist.ts`
- `01/mcp/linkup-dev-mcp/src/tools/runtime-status.ts`
- `01/mcp/linkup-dev-mcp/src/tools/runtime-scene-tree.ts`
- `01/mcp/linkup-dev-mcp/src/tools/runtime-node-detail.ts`
- `01/mcp/linkup-dev-mcp/src/tools/runtime-console-logs.ts`
- `01/mcp/linkup-dev-mcp/src/tools/runtime-capture-preview.ts`
- `01/mcp/linkup-dev-mcp/src/schemas/runtime-*.ts`
- `01/mcp/linkup-dev-mcp/test/runtime/unit.test.ts`
- `01/mcp/linkup-dev-mcp/test/runtime/protocol.test.ts`
- `01/LinkUpClient/project.json`
- `01/LinkUpClient/assets/Scripts/**`

## 2. Automated Verification Re-run

Commands actually re-run:

```bash
cd 01/mcp/linkup-dev-mcp
npm run typecheck
npm run build
npm test
node --test dist/test/runtime/unit.test.js dist/test/runtime/protocol.test.js
```

Observed facts:

- `typecheck` exit code 0
- `build` exit code 0
- `npm test` exit code 0
- full test summary observed: 88 pass, 0 fail
- focused runtime suite summary observed: 26 pass, 0 fail
- disconnected protocol checks still pass under local sandbox restrictions:
  - `runtime_status` returns `disconnected`
  - response time observed 3-6ms
  - other Runtime tools return `RUNTIME_UNAVAILABLE`

## 3. Real Runtime Verification Performed

### 3.1 Live editor and preview facts

Actual environment verified:

- Cocos Creator app path used: `/Applications/Cocos/Creator/2.4.15/CocosCreator.app`
- live editor window title: `Cocos Creator - LinkUpClient - db://assets/LinkUp.fire`
- preview launched from actual GUI menu item: `项目 -> 运行预览`
- live preview page observed in Chrome: `http://localhost:7456/`

Non-sandbox localhost checks actually executed:

```bash
curl -s http://127.0.0.1:7456 | head -20
curl -s http://127.0.0.1:9222/json/version
curl -s http://127.0.0.1:9222/json
```

Observed facts:

- preview server returned HTML titled `CocosCreator | LinkUpClient`
- Chrome DevTools port returned `Browser: Chrome/149.0.7827.201`
- CDP target list contained one page target at `http://localhost:7456/`

### 3.2 Real Runtime tool results

Actual MCP Runtime calls were executed against the live preview page.

Observed results:

- `runtime_status`
  - `status: "connected"`
  - `scene: "LinkUp"`
  - `resolution: 750 x 1334`
  - `visibleSize: 750 x 1624`
  - `fps: 60`
  - `pageUrl: http://localhost:7456/`

- `runtime_scene_tree` with `{ maxDepth: 2, maxNodes: 50 }`
  - `totalNodes: 7`
  - `truncated: false`
  - real nodes observed include `LinkUp`, `Canvas`, `MainCamera`, `UIRoot`, `PROFILER-NODE`

- `runtime_scene_tree` with `{ maxDepth: 1, maxNodes: 3 }`
  - `totalNodes: 3`
  - `truncated: true`

- `runtime_node_detail` with `{ nodePath: "Canvas" }`
  - `name: "Canvas"`
  - `path: "Canvas"`
  - `active: true`
  - `size: 750 x 1624`
  - components observed: `cc_Canvas`, `cc_Widget`, `Main`

- `runtime_capture_preview` with `{ format: "png" }`
  - `format: "png"`
  - `width: 750`
  - `height: 1624`
  - `sizeBytes: 878931`

## 4. Acceptance Issue Found and Fixed During Acceptance

### 4.1 Issue

During real-runtime acceptance, `runtime_console_logs` did not return `console.warn(...)` entries when filtered by `level: "warn"` or `level: "warning"`.

Independent evidence:

- live CDP probe produced a buffered entry:
  - `level: "warning"`
  - `text: "G4_WARN_LEVEL_PROBE"`
- current handler mapped input `warning -> warn`, which missed actual CDP `warning` entries

### 4.2 Fix applied

Files updated:

- `01/mcp/linkup-dev-mcp/src/runtime/cdp-manager.ts`
- `01/mcp/linkup-dev-mcp/src/tools/runtime-console-logs.ts`
- `01/mcp/linkup-dev-mcp/test/runtime/unit.test.ts`

Fix summary:

- treat `warn` and `warning` as equivalent filter values
- stop rewriting `warning` to `warn` in the handler
- add a unit test that covers both spellings

### 4.3 Post-fix real verification

Actual live re-check after the fix:

- injected `console.warn("G4_WARN_FIXED_MARKER")` into the live preview page
- `runtime_console_logs { level: "warn" }` returned:
  - `level: "warning"`
  - `text: "G4_WARN_FIXED_MARKER"`
- `runtime_console_logs { level: "warning" }` returned the same marker

Additional live filter checks:

- `runtime_console_logs { level: "log" }` returned `G4_INFO_MARKER`
- `runtime_console_logs { level: "error" }` returned `G4_ERROR_MARKER`

## 5. G4 Acceptance Matrix

| ID | Acceptance item | Method actually used | Result |
|---|---|---|---|
| G4-01 | disconnected state | reran `dist/test/runtime/protocol.test.js` | PASS |
| G4-02 | connected state | live preview + live `runtime_status` | PASS |
| G4-03 | scene depth / node limit | live `runtime_scene_tree { maxDepth:1, maxNodes:3 }` + clamp tests | PASS |
| G4-04 | node detail | live `runtime_node_detail { nodePath:"Canvas" }` | PASS |
| G4-05 | log filtering | live CDP marker injection + live `runtime_console_logs` filter checks | PASS |
| G4-06 | screenshot | live `runtime_capture_preview { format:"png" }` | PASS |
| G4-07 | no arbitrary eval path | whitelist code inspection + existing security/runtime tests | PASS |
| G4-08 | no Bridge in formal build path | checked `01/LinkUpClient/assets/Scripts/**`; no `Dev/` Runtime Bridge path created | PASS |

## 6. Scope / Safety Facts

- `01/LinkUpClient/**` business code was not modified during this acceptance fix
- Runtime fix was limited to `01/mcp/linkup-dev-mcp/**`
- no `assets/Scripts/Dev/` Runtime Bridge implementation was introduced into `01/LinkUpClient`
- G4 final independent decision is therefore `PASS`

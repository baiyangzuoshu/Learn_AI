# G6 Start Gate Record

> Date: 2026-07-02  
> Scope: G6 start readiness only  
> Decision: READY FOR G6 (full Runtime scope)

## 1. Gate Basis

G6 gate requirements come from:

- `01/docs/linkup-agent-implementation-plan.md`
- `01/docs/linkup-ai-engineering-master-plan.md`

Relevant preconditions:

- G1 PASS
- G2 PASS
- G3 PASS
- G4 PASS
- G5 PASS
- selected Agent Host and version
- frozen scenario inputs and permissions

## 2. Accepted Prerequisites

| Stage | Evidence file | Status |
|---|---|---|
| G1 | `01/docs/acceptance/G1-acceptance-20260702.md` | PASS |
| G2 | `01/docs/acceptance/G2-acceptance-20260702.md` | PASS |
| G3 | `01/docs/acceptance/G3-acceptance-20260702.md` | PASS |
| G4 | `01/docs/acceptance/G4-acceptance-20260702.md` | PASS |
| G5 | `01/docs/acceptance/G5-acceptance-20260702.md` | PASS |

## 3. Frozen G6 Execution Parameters

### Agent Host

- Host: Codex desktop
- Model family: GPT-5
- Capabilities in scope:
  - files
  - shell
  - approved project skill
  - accepted linkup-check
  - accepted linkup-dev-mcp static capabilities
  - accepted linkup-dev-mcp Runtime capabilities

### Runtime scope

- Runtime task: included in this gate version
- Runtime prerequisite evidence:
  - live Cocos Creator 2.4.15 project window verified
  - live preview target verified at `http://localhost:7456/`
  - live Chrome DevTools target verified at `127.0.0.1:9222`
  - independent G4 PASS recorded in `01/docs/acceptance/G4-acceptance-20260702.md`

## 4. Frozen G6 Scenario Set

### G6-S01: Static diagnosis on real project

- Goal: verify fact discovery and static diagnosis on actual repository files
- Input type: read-only real project
- Required capabilities:
  - files
  - shell
  - skill
  - linkup-check
- Allowed writes: none

### G6-S02: UI-contract modification on temp-copy/fixture

- Goal: verify small authorized GUI/controller workflow without touching real project
- Input type: temp-copy or isolated fixture
- Required capabilities:
  - files
  - shell
  - skill
  - linkup-check
- Allowed writes:
  - `/tmp/linkup-agent-evals/**`
- Real project writes: forbidden

### G6-S03: MCP-assisted contract query

- Goal: verify correct selection and use of accepted static MCP abilities
- Input type: read-only project + MCP read/query
- Required capabilities:
  - files
  - mcp
- Allowed writes: none

### G6-S04: Runtime observation on live preview

- Goal: verify correct use of accepted Runtime MCP abilities against the live LinkUpClient preview
- Input type: live Cocos Creator 2.4.15 browser preview + MCP Runtime query
- Required capabilities:
  - files
  - shell
  - mcp
- Allowed writes: none to project files
- Live prerequisites:
  - `01/LinkUpClient` open in Cocos Creator 2.4.15
  - browser preview reachable at `http://localhost:7456/`
  - Chrome DevTools reachable at `127.0.0.1:9222`

## 5. Frozen Permissions Boundary

- `01/LinkUpClient/**`: read-only unless separately authorized later
- `01/tools/**`: read-only
- `01/skill/**`: read-only
- `01/mcp/**`: read-only
- `/tmp/linkup-agent-evals/**`: writable for temp artifacts
- Network install: forbidden
- Git commit/push/PR: forbidden
- Runtime observation: in scope, but only through accepted MCP Runtime tools
- Runtime mutation / arbitrary page scripting by implementation AI: forbidden

## 6. Start Decision

Formal gate decision:

`READY FOR G6 (full Runtime scope)`

Meaning:

- G6 may start for static/UI-contract/MCP/Runtime scenarios within the frozen scope above
- Runtime use is limited to observation through accepted G4 tools
- any expansion into real-project write or broader browser automation still requires separate authorization

## 7. Remaining Non-Gate Notes

- a real-runtime acceptance issue was found in `runtime_console_logs` warning filtering and fixed before this gate was reopened
- G6 should use the post-fix Runtime implementation and report evidence against the frozen live prerequisites above

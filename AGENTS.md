# Deno Agent — AI Development Instructions

This repository is a Deno 2.9 Desktop application that implements a local AI coding agent without
Electron, Node.js runtime, or a Rust application layer.

## Product Architecture

- `src/harness/mod.ts` is the only production Harness entry point.
- `src/harness/runtime.ts` owns the agent loop, permission checks, hooks, context compaction, tool
  execution, and provider retry behavior.
- `src/harness/features/` contains production feature modules. Register new tools and prompt
  sections through the feature registration contract.
- `src/harness/scheduler.ts` owns recurring AI conversation scheduling and persistence.
- `src/config/` owns settings, secrets integration, application paths, workspaces, and conversation
  persistence.
- `src/providers/` owns model-provider clients and telemetry.
- `desktop/main.ts` is the Deno Desktop backend and HTTP API entry point.
- `desktop/renderer/` is a framework-free HTML/CSS/JavaScript UI.
- `stages/s01_*.ts` through `stages/s20_*.ts` are teaching examples only.

## Critical Boundary

Production code under `src/` and `desktop/` must never import from `stages/`.

Do not implement a production feature by moving, renaming, or directly importing a stage file. Use
the stage only as behavioral reference, then design the production implementation around the
contracts in `src/harness/`.

After architecture changes, this command must return no matches:

```sh
rg 'stages/' src desktop
```

## Harness Development

- Keep one agent loop in `AgentRuntime`; do not create parallel loops for individual features.
- Add tools through `ToolRegistry`, not hard-coded conditionals in the runtime.
- Add system instructions through `PromptRegistry`, with stable IDs and explicit priorities.
- Implement independently removable capabilities as `HarnessFeature` modules.
- Pass the workspace explicitly through `RunOptions` and `ToolContext`.
- Preserve `AbortSignal` propagation through provider calls, tools, nested agents, background work,
  and scheduled tasks.
- A cancelled run must terminate or explicitly detach any child process it started. Do not leave
  Shell commands, background jobs, nested agents, or scheduled executions running accidentally.
- Emit user-visible tool events and developer-only hook events through `HarnessEvent`.
- Nested agent, team, and autonomous execution must be bounded and must prevent uncontrolled
  recursive delegation.
- Bound the main tool-use loop as well as nested orchestration. Add explicit limits for tool calls,
  iterations, concurrency, and retained output instead of relying on the model to stop itself.
- Keep tool output bounded. File tools should normally return paths and concise metadata instead of
  dumping large file contents into the UI.

## Permission and Safety Rules

The three permission modes are:

- `ask`: request approval for mutating or dangerous actions.
- `auto`: automatically approve ordinary workspace-scoped actions while retaining safety checks.
- `full`: allow unrestricted tool execution only when explicitly selected by the user.

Do not weaken permission behavior to make a test pass. Every new tool must be explicitly classified
as read-only, mutating, externally effectful, or dangerous by the permission system. Shell commands
are externally effectful and must request approval in `ask` mode even when the command is not on a
hard-deny list. Memory, task graph, scheduler, background-process, Git worktree, and MCP mutations
must follow the same rule.

Hard-deny checks are a safety backstop, not a substitute for approval. Validate workspace paths at
execution time, and do not let `auto` mode escape the active workspace or bypass destructive-command
guards. `full` mode is valid only after an explicit user selection.

Never commit API keys, tokens, passwords, Keychain output, `.env.local`, or user conversation data.
Release builds must not embed development environment files. API keys must use the platform
credential mechanism or explicitly provided environment variables.

Do not return plaintext credentials from general-purpose HTTP endpoints or include them in logs,
telemetry, tool events, error messages, or renderer state. A credential reveal flow, if retained,
must be explicit, narrowly scoped, local-only, and must avoid persisting the revealed value.

Remote MCP endpoints must use HTTPS. Plain HTTP is allowed only for localhost development endpoints.

## Persistence and Cross-Platform Paths

Use `src/config/paths.ts` for application data paths. Do not hard-code the macOS Application Support
path in production modules.

Expected data roots:

- macOS: `~/Library/Application Support/DenoAgent`
- Windows: `%APPDATA%/DenoAgent`
- Linux: `$XDG_DATA_HOME/DenoAgent` or `~/.local/share/DenoAgent`

Write persisted JSON atomically through a temporary file followed by rename. Validate all data
loaded from disk or received through HTTP APIs.

OS-specific commands must be guarded by `Deno.build.os` and have a supported fallback or a clear
platform-specific error.

## Desktop UI Rules

- Do not add Electron or a frontend framework unless the user explicitly changes the architecture.
- The conversation input remains fixed while message content scrolls.
- Preserve workspace → conversations tree hierarchy and deletion confirmation.
- Keep the tools panel collapsible/floating so it does not permanently reduce conversation width.
- Enter submits; Shift+Enter inserts a newline.
- Streaming must tolerate cancellation and client disconnect without closing or enqueueing an
  already-closed stream.
- Local HTTP APIs must bind to loopback only. Validate request bodies at the backend boundary and do
  not assume that requests from the bundled renderer are inherently trusted.
- Do not display full file contents in tool cards. Show a clickable file path and concise operation
  result.
- Model, workspace, token, context, compression, cost, and balance telemetry belong in the bottom
  status area.
- Developer-only Hook events must remain hidden unless Developer Mode is enabled.

## Verification

Run the smallest relevant checks while developing, then run the production checks before completion:

```sh
deno fmt --check src/harness desktop/main.ts README.md AGENTS.md
deno task check
rg 'stages/' src desktop
deno task desktop:build:mac-arm64
```

The repository contains intentionally compact legacy UI CSS and teaching files, so avoid formatting
unrelated files merely to satisfy a whole-repository format check.

For release or cross-platform changes, also run:

```sh
deno task desktop:build:all
```

Expected artifacts:

- `dist/releases/macos-arm64/DenoAgent.app`
- `dist/releases/macos-x64/DenoAgent.app`
- `dist/releases/windows-x64/DenoAgent.msi`
- `dist/releases/linux-x64/DenoAgent.AppImage`
- `dist/releases/linux-arm64/DenoAgent.AppImage`

Build output must embed `desktop/` and `src/`, never `stages/`.

Cross-compilation verifies compilation and packaging, not native runtime behavior. Before release,
test credential storage, directory selection, shell execution, Git, WebView behavior, and
application shutdown on each target operating system.

## Change Discipline

- Preserve unrelated user changes and generated release artifacts unless the task explicitly covers
  them.
- Prefer small cohesive modules over adding more responsibilities to `desktop/main.ts`.
- Keep public contracts typed and avoid `any` when a narrow runtime-validated type is practical.
- Update `README.md` whenever architecture, setup, persistence, models, permissions, or release
  commands change.
- Do not report a migration complete until production imports, type checks, and at least one
  production desktop build have been verified.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and
cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing
anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json
  exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for
  focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw
  grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are
  not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph
  output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do
  not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

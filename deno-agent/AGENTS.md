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
- Emit user-visible tool events and developer-only hook events through `HarnessEvent`.
- Nested agent, team, and autonomous execution must be bounded and must prevent uncontrolled
  recursive delegation.
- Keep tool output bounded. File tools should normally return paths and concise metadata instead of
  dumping large file contents into the UI.

## Permission and Safety Rules

The three permission modes are:

- `ask`: request approval for mutating or dangerous actions.
- `auto`: automatically approve ordinary workspace-scoped actions while retaining safety checks.
- `full`: allow unrestricted tool execution only when explicitly selected by the user.

Do not weaken permission behavior to make a test pass. New mutating tools must be classified by the
permission system.

Never commit API keys, tokens, passwords, Keychain output, `.env.local`, or user conversation data.
Release builds must not embed development environment files. API keys must use the platform
credential mechanism or explicitly provided environment variables.

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

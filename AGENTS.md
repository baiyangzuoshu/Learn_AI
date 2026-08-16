# AI Agent — Development Instructions

This repository contains an Agent engine, an Electron desktop application, and an independent set of
teaching stages. The production desktop runtime and packaging use Node.js and Electron.

## Product Architecture

- `src/mod.ts` is the only production Harness entry point.
- `src/runtime.ts` owns the agent loop, permission checks, hooks, context compaction, tool
  execution, and provider retry behavior.
- `src/features/` contains production feature modules. Register new tools and prompt sections
  through the feature registration contract.
- `src/scheduler.ts` owns recurring AI conversation scheduling and persistence.
- `src/config/` owns settings, secrets integration, application paths, workspaces, and conversation
  persistence.
- `src/providers/` owns model-provider clients and telemetry.
- `electron/main.ts` is the Electron desktop entry point.
- `electron/preload.ts` is the context-isolated renderer bridge.
- `desktop/http.ts` and `desktop/services/` provide the shared local API and desktop services.
- `desktop/renderer/` is a framework-free HTML/CSS/JavaScript UI.
- `stages/s01_*/code.ts` through `stages/s40_*/code.ts` are teaching examples only.

## Critical Boundary

Production code under `src/` and `desktop/` must never import from `stages/`.

Do not implement a production feature by moving, renaming, or directly importing a stage file. Use
the stage only as behavioral reference, then design the production implementation around the
contracts in `src/`.

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

- macOS: `~/Library/Application Support/AIAgent`
- Windows: `%APPDATA%/AIAgent`
- Linux: `$XDG_DATA_HOME/AIAgent` or `~/.local/share/AIAgent`

Write persisted JSON atomically through a temporary file followed by rename. Validate all data
loaded from disk or received through HTTP APIs.

OS-specific commands must be guarded by `process.platform` and have a supported fallback or a clear
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
deno fmt --check src desktop README.md AGENTS.md
deno task check
rg 'stages/' src desktop
npm --prefix electron run dist:win
```

The repository contains intentionally compact legacy UI CSS and teaching files, so avoid formatting
unrelated files merely to satisfy a whole-repository format check.

For release or cross-platform changes, also run:

```sh
npm --prefix electron run dist:win
npm --prefix electron run dist:mac
npm --prefix electron run dist:linux
```

Expected artifacts:

- Electron Builder artifacts under `dist/releases/app/`

### macOS App-only Packaging (重要)

When the user asks to “打包 app” or says “不要 zip”, the deliverable is the unpacked macOS
application bundle only. Do not use the generic `dist` script and do not run Electron Builder with
the default macOS targets, because those targets may create a zip archive.

Use the repository script, which explicitly uses `--mac --arm64 --dir`:

```sh
npm --prefix electron run dist:mac
```

The only artifact to report is:

```text
dist/releases/app/mac-arm64/AI Agent.app
```

Before reporting completion, verify the bundle exists and remove only stale generated macOS zip
archives from the same output directory. A stale archive is not a valid deliverable:

```sh
test -d "dist/releases/app/mac-arm64/AI Agent.app"
find dist/releases/app -maxdepth 1 -type f -name 'AI-Agent-*-mac-*.zip' -print
```

If Electron Builder has already packaged the app but then fails while downloading optional GitHub
metadata or signing assets because of DNS/network restrictions, do not report the failed command as
the finished package. Run `npm --prefix electron run build`, refresh the bundle’s
`Contents/Resources/app.asar` from a temporary staging directory containing both
`electron/package.json` and `electron/dist/` (the package manifest is required for Electron to
resolve `main`; packing `electron/dist` alone causes the default Electron welcome screen). Use the
local `electron/node_modules/.bin/asar`, apply an ad-hoc signature with
`codesign --force --deep --sign -`, then verify with
`codesign --verify --deep --strict --verbose=2`. Report the `.app` path and the network limitation
separately. Never hand back the zip as a substitute for the requested `.app`.

#### App 打包交付清单（每次都必须执行）

当用户要求“打包 app”时，不得只报告源码构建成功，也不得把失败的 Builder 命令当作交付完成。必须：

1. 执行 `npm --prefix electron run dist:mac`。
2. 确认 `dist/releases/app/mac-arm64/AI Agent.app` 是本次最新构建的目录。
3. 使用 `codesign --verify --deep --strict` 校验 App；网络失败时按上面的本地 `asar`
   兜底流程继续完成。
4. 最终回复必须给出 `.app` 的绝对路径，并明确说明是否生成 zip；zip 不能替代 `.app` 交付。

### Windows Offline Packaging

Keep the following Electron Builder archives under `tools/` so Windows packaging can run when GitHub
release downloads are unavailable:

- `7zip-win-x64.tar.gz`
- `nsis-3.0.4.1.7z`
- `nsis-resources-3.4.1.7z`
- `winCodeSign-2.6.0.7z`

The extracted/cache directories under `tools/` are generated files and must remain ignored by Git.
From the repository root, prepare the local tool directories with PowerShell:

```powershell
$repoRoot = (Get-Location).Path
$toolRoot = Join-Path $repoRoot "tools"
$sevenRoot = Join-Path $toolRoot "7zip-extracted"
$nsisRoot = Join-Path $toolRoot "nsis-extracted"
$resourcesRoot = Join-Path $toolRoot "nsis-resources-extracted"
$codeSignRoot = Join-Path $toolRoot "winCodeSign-extracted"

New-Item -ItemType Directory -Force -Path $sevenRoot, $nsisRoot, $resourcesRoot, $codeSignRoot |
  Out-Null
tar.exe -xzf (Join-Path $toolRoot "7zip-win-x64.tar.gz") -C $sevenRoot --strip-components=1

$sevenZip = Join-Path $sevenRoot "bin\7za.exe"
& $sevenZip x (Join-Path $toolRoot "nsis-3.0.4.1.7z") ("-o" + $nsisRoot) -y
& $sevenZip x (Join-Path $toolRoot "nsis-resources-3.4.1.7z") ("-o" + $resourcesRoot) -y
& $sevenZip e (Join-Path $toolRoot "winCodeSign-2.6.0.7z") `
  "rcedit-ia32.exe" "rcedit-x64.exe" ("-o" + $codeSignRoot) -y
Copy-Item (Join-Path $codeSignRoot "rcedit-ia32.exe") `
  (Join-Path $codeSignRoot "rcedit-x86.exe") -Force
```

Then build the Windows x64 NSIS installer with the local tools and the installed Electron runtime:

```powershell
$repoRoot = (Get-Location).Path
$toolRoot = Join-Path $repoRoot "tools"
$env:ELECTRON_BUILDER_CACHE = $toolRoot
$env:ELECTRON_BUILDER_7ZIP_PATH = Join-Path $toolRoot "7zip-extracted\bin\7za.exe"
$env:ELECTRON_BUILDER_RCEDIT_PATH = Join-Path $toolRoot "winCodeSign-extracted"
$env:ELECTRON_BUILDER_NSIS_DIR = Join-Path $toolRoot "nsis-extracted"
$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR = Join-Path $toolRoot "nsis-resources-extracted"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$electronDist = Join-Path $repoRoot "electron\node_modules\electron\dist"

Push-Location (Join-Path $repoRoot "electron")
npm.cmd run build
npx.cmd electron-builder --win nsis --x64 `
  --config.win.target=nsis `
  --config.electronDist=$electronDist
Pop-Location
```

Use `npm.cmd` and `npx.cmd` on Windows because PowerShell execution policy may block the `.ps1`
launchers. The explicit `--config.win.target=nsis` override is required for an x64-only build:
`electron/package.json` currently declares both x64 and arm64 under `build.win.target`, and `--x64`
alone does not override that architecture list.

The expected installer is `dist/releases/app/AI Agent Setup <version>.exe`, accompanied by its
`.blockmap`. The unpacked executable is under `dist/releases/app/win-unpacked/`.

Build output must embed `desktop/` and `src/`, never `stages/`.

Cross-compilation verifies compilation and packaging, not native runtime behavior. Before release,
test credential storage, directory selection, shell execution, Git, WebView behavior, and
application shutdown on each target operating system.

For every production or desktop change, always run the Electron Windows package as a required
verification step:

```sh
npm --prefix electron run dist:win
```

## Change Discipline

- Preserve unrelated user changes and generated release artifacts unless the task explicitly covers
  them.
- Prefer small cohesive modules over adding more responsibilities to `electron/main.ts`.
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

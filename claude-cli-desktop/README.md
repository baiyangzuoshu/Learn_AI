# Claude CLI Studio

An independent Electron desktop client that runs Claude Code locally and can route it to DeepSeek's Anthropic-compatible API.

## Development

Requirements: macOS, Node.js 22+ for development, and Claude Code CLI installed locally.

```sh
npm install
npm run dev
```

The app looks for `claude` on `PATH` and in standard macOS install directories, so common Homebrew and native Claude Code installations can be found when Electron is started from Finder.

## Projects and sessions

Add a project by choosing a folder; the app starts its first conversation in that folder. Each project directory can contain multiple independent conversations. Click a project row to expand or collapse them, and use the `+` action on that row to start another conversation in the same directory. Double-click a conversation to rename it, or use its visible `×` button to delete it. Use the project row's `×` action to remove that project and all of its conversations from Studio. Deletion requires confirmation and removes local conversation history only; the project directory and code remain on disk. A running session must be stopped before its conversation or project can be removed.

## API key storage

The DeepSeek API key is stored as a plaintext local file at `~/Library/Application Support/Claude CLI Studio/secrets/deepseek-api-key`. The file is owner-readable and writable (`0600`), and the `secrets` directory is owner-only (`0700`). The app does not use macOS Keychain for API keys. The key is not written to this repository, `.env` files, settings JSON, renderer storage, logs, or Git. The repository `.gitignore` excludes `secrets/` and build output.

Older releases stored an encrypted `deepseek-api-key.bin` file. This version does not access Keychain to decrypt it; the old file stays in place until a new key is saved in Settings. Saving a new key writes the local file and then removes the old encrypted file.

The repository `.gitignore` also excludes build output, local data, secrets, and `.env` files. No API key is included in the repository.

## Run limits

Each request is limited to 12 agentic turns. If the model produces no progress for 90 seconds, the app closes the CLI process and shows a timeout message. A tool execution can run for up to 10 minutes without an SDK event before the same watchdog stops it. The Stop button also aborts the SDK request and closes its CLI process.

## Build

```sh
npm run typecheck
npm run build
npm run dist:mac
```

The first macOS build produces an unpacked Apple Silicon app under `release/mac-arm64/Claude CLI Studio.app/`.

## Permission modes

Choose a mode from the selector in the bottom bar. The selection is saved in the local settings file and takes effect immediately for pending and future tool permission requests, including while a turn is running:

- **Ask permissions** keeps Claude Code's normal permission prompts.
- **Accept edits** automatically approves file edits while other permission requests, including commands, still require approval.
- **Full access** automatically approves tool permission requests. The app shows a warning before enabling it because commands can access files outside the selected project and use the network.

The default is Ask permissions. Existing saved plan mode settings migrate to Ask permissions.

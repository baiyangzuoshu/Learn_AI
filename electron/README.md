# Electron Desktop

This directory contains the cross-platform desktop shell for AI Agent. It uses
Electron's main process for the local API server, agent runtime, native dialogs,
secure credential storage, and child processes. The renderer is the existing
framework-free HTML/CSS/JavaScript UI.

## Development

```sh
cd electron
npm install
npm run dev
```

## Packaging

```sh
npm run dist:win    # Windows x64 + arm64 NSIS installer
npm run dist:mac    # macOS .app application bundle
npm run dist:linux  # Linux AppImage
```

The desktop build is produced by Electron Builder and uses Node.js at runtime.
Cross-compiling from macOS or Linux may require Wine for the Windows installer;
the `build` and `typecheck` commands do not require a Windows host.

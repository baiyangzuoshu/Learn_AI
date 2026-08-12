# AI Agent 部署与发布

AI Agent 桌面端使用 Node.js、Electron 和 Electron Builder。课程与底层测试仍可使用
`deno.json`，但 Deno 不参与桌面运行或安装包构建。

## 本地开发

```sh
npm --prefix electron install
npm --prefix electron run typecheck
npm --prefix electron run dev
```

课程检查是独立流程：

```sh
deno task check
deno task test
```

## 安装包构建

```sh
npm --prefix electron run dist:win
npm --prefix electron run dist:mac
npm --prefix electron run dist:linux
```

默认产物目录：

```text
dist/releases/app/
├── AI Agent Setup.exe
├── mac-arm64/AI Agent.app
└── AI Agent.AppImage
```

macOS 的 `.app` 可直接双击运行，也可按需拖到 `/Applications`。正式对外发布前，需要使用
Developer ID Application 签署 `.app` 并完成 Apple 公证。

## 版本与更新

版本号在 `electron/package.json`。发布 tag 推荐使用 `v1.0.2` 或 `ai-agent-v1.0.2`。

应用支持 GitHub latest release API 或自定义 HTTPS manifest：

```sh
AI_AGENT_UPDATE_URL=https://api.github.com/repos/baiyangzuoshu/Learn_AI/releases/latest
```

```json
{
  "version": "1.0.2",
  "url": "https://example.com/ai-agent/releases/1.0.2",
  "downloadUrl": "https://example.com/ai-agent/releases/AIAgent-v1.0.2-macos-arm64.zip",
  "notes": "Release notes"
}
```

自动替换更新使用包含 `AI Agent.app` 的 macOS ZIP；本机构建产物则可直接运行 `.app`。

## 发布前检查

```sh
npm --prefix electron run typecheck
npm --prefix electron run build
rg 'stages/' src desktop
npm --prefix electron run dist:win
npm --prefix electron run dist:mac
```

还应在目标系统验证启动、目录选择、凭据存储、Shell、Git、WebView、应用退出和安装覆盖升级。

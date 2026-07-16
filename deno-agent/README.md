# Deno Agent

基于 Deno 2.9 Desktop 和系统 WebView 构建的本地 AI 编程 Agent。项目不依赖 Electron、Node.js 运行时或
Rust 工具链，完整实现 `learn-claude-code` 的 s01–s20 Agent Harness。

## 功能

- Agent Loop、文件工具、Shell 与三档权限控制
- Hooks、Todo、Subagent、Skill 按需加载
- 上下文压缩、项目 Memory、系统提示组装与错误恢复
- 持久化任务图、后台任务和周期性 AI 对话任务
- Agent Teams、团队消息协议和有边界自治循环
- Git Worktree 隔离与 HTTP MCP 插件
- 多工作区、多对话、聊天持久化、Keychain 密钥管理
- DeepSeek 模型切换、Token/缓存命中状态栏和开发者事件抽屉

## 文档

- [架构说明](docs/ARCHITECTURE.md)：系统分层、Agent Runtime、Feature、权限、持久化和更新架构。
- [部署与发布](docs/DEPLOYMENT.md)：开发运行、打包、版本号、GitHub Release 上传和自动更新流程。

## 源码结构

```text
deno-agent/
├── src/
│   ├── harness/              # s01–s20 完整 Agent Harness
│   ├── config/               # 设置、路径、聊天持久化
│   ├── core/                 # 核心类型
│   └── providers/            # DeepSeek API 与 usage 遥测
├── desktop/
│   ├── main.ts               # Deno Desktop 后端入口
│   └── renderer/             # 原生 HTML/CSS/JS 桌面界面
├── deno.json
└── dist/
```

`desktop/main.ts` 是唯一产品入口，并调用 `src/harness/mod.ts` 中的正式 Harness。 `stages/` 保留为
s01–s20 的教学演进示例，不进入正式桌面运行时依赖图。

正式 Harness 按职责拆分为：

- `runtime.ts`：统一 Agent loop、重试、Hooks、权限与上下文压缩
- `registry.ts` / `prompt.ts`：工具和系统提示注册
- `features/`：文件工具、生产力、编排、后台任务、Worktree、MCP、定时任务
- `scheduler.ts`：跨平台持久化的周期 AI 对话调度服务

## 开发运行

要求 Deno 2.9 或更新版本：

```sh
deno --version
deno task check
deno task desktop:hmr
```

`deno task s01` 到 `deno task s20` 用于学习和对照各阶段机制。运行桌面应用：

```sh
deno task desktop
```

## 模型配置

首次启动后，在“设置 → 模型”中配置 DeepSeek：

```text
Base URL: https://api.deepseek.com
Models: deepseek-v4-flash, deepseek-v4-pro
```

macOS API Key 保存到 Keychain。也可以通过环境变量提供：

```sh
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

发布构建不会读取或嵌入 `.env.local`。

## 软件更新

“设置 → 更新”提供版本查看、启动时检测开关、手动检查更新和“下载并重启更新”。自动安装流程会下载 GitHub
Release 中的 macOS `.zip` 更新包，退出当前 App，替换 `.app` 后重新打开。

默认更新源是当前公开 GitHub 仓库的 latest release API：

```text
https://api.github.com/repos/baiyangzuoshu/Learn_AI/releases/latest
```

GitHub Releases 必须能被匿名访问；如果仓库是 private，GitHub API 会对未授权请求返回 404，App
内的更新检查和自动下载都会失败。若源码仓库需要保持 private，建议额外创建一个只放发布包的 public
release 仓库，并把更新源改到那个仓库。

发布新版本有两种方式。

方式一：本机 token 发布，不依赖 GitHub Actions：

```sh
export GITHUB_TOKEN=ghp_xxx
deno task release:github v1.0.1
```

脚本会自动检查版本、构建 macOS arm64 App、压缩 zip、创建或更新 GitHub Release，并上传
`DenoAgent-v1.0.1-macos-arm64.zip`。

方式二：推送 tag，让仓库根目录的 GitHub Actions workflow 自动创建 Release 并上传 zip：

```sh
git tag v1.0.1
git push origin v1.0.1
```

也可以在 GitHub Actions 页面手动运行 `Release Deno Agent` workflow，输入 `v1.0.1` 这类版本号。
标签名建议使用 `v1.1.0` 或 `deno-agent-v1.1.0`。

应用会从 `tag_name` 中提取语义版本号进行比较，并优先选择名字包含 `DenoAgent`、`macos`、`arm64` 的
`.zip` asset 作为自动安装包。zip 根目录需要包含 `DenoAgent.app`。

当前测试更新版本为 `1.0.1`，可用 GitHub Release tag `v1.0.1` 验证更新检测链路。

也可以在设置页或环境变量中覆盖更新源：

```sh
DENO_AGENT_UPDATE_URL=https://api.github.com/repos/baiyangzuoshu/Learn_AI/releases/latest
```

除 GitHub latest release API 返回的 `tag_name`、`html_url`、`body` 字段外，也支持简单 manifest：

```json
{
  "version": "1.1.0",
  "url": "https://example.com/deno-agent/releases/1.1.0",
  "downloadUrl": "https://example.com/deno-agent/releases/DenoAgent-v1.1.0-macos-arm64.zip",
  "notes": "Release notes"
}
```

## 本地数据

| 平台    | 数据目录                                                 |
| ------- | -------------------------------------------------------- |
| macOS   | `~/Library/Application Support/DenoAgent`                |
| Windows | `%APPDATA%/DenoAgent`                                    |
| Linux   | `$XDG_DATA_HOME/DenoAgent` 或 `~/.local/share/DenoAgent` |

聊天、Memory、任务图和定时任务按工作区隔离。项目路径经 SHA-256 生成本地文件标识。

## MCP

在项目中创建 `.deno-agent/mcp.json`：

```json
{
  "servers": [
    {
      "name": "local-tools",
      "url": "http://127.0.0.1:3000/mcp",
      "enabled": true
    }
  ]
}
```

仅允许 HTTPS 远程服务或 localhost HTTP 服务。MCP 工具按需发现，实际调用受权限模式控制。

## 构建与发布

Deno Desktop 支持在一台机器上交叉构建全部目标：

```sh
deno task desktop:build:all
```

也可以分别构建：

```sh
deno task desktop:build:mac-arm64
deno task desktop:build:mac-x64
deno task desktop:build:windows
deno task desktop:build:linux-x64
deno task desktop:build:linux-arm64
```

产物目录：

```text
dist/releases/
├── macos-arm64/DenoAgent.app
├── macos-x64/DenoAgent.app
├── windows-x64/DenoAgent.msi
├── linux-x64/DenoAgent.AppImage
└── linux-arm64/DenoAgent.AppImage
```

目标平台：

| 平台                | Deno target                 | 格式        |
| ------------------- | --------------------------- | ----------- |
| macOS Apple Silicon | `aarch64-apple-darwin`      | `.app`      |
| macOS Intel         | `x86_64-apple-darwin`       | `.app`      |
| Windows x64         | `x86_64-pc-windows-msvc`    | `.msi`      |
| Linux x64           | `x86_64-unknown-linux-gnu`  | `.AppImage` |
| Linux ARM64         | `aarch64-unknown-linux-gnu` | `.AppImage` |

首次交叉构建会下载对应平台的 Deno Runtime 和 WebView
后端，后续构建使用本地缓存。正式分发前仍应在目标系统进行启动、文件选择器、凭据存储、Shell、Git
和系统 WebView 验收，并配置平台代码签名。

## 验证

```sh
deno fmt --check src/harness desktop/main.ts README.md AGENTS.md
deno task check
rg 'stages/' desktop src
```

最后一条命令应无输出，证明生产代码没有回退依赖教学示例。

桌面开发版在设置中开启“开发者模式”后，可以查看 Hook、工具、团队、自治、Worktree、MCP 和 Harness
自检事件。

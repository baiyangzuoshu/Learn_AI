# AI Agent

AI Agent 是一个面向开发者的本地 Agent 客户端。它把对话、工作区、文件编辑、Shell、MCP
工具、技能、定时任务、软件更新和模型用量遥测整合到一个桌面应用里。

桌面端基于 Electron 构建，Windows、macOS、Linux 均使用 Electron Builder 打包，运行时使用 Node.js。
`src/` 根目录中的 Runtime、Feature、工具、提示、权限和调度模块组成内部 Agent 引擎，`electron/`
是桌面主进程和打包入口，`desktop/` 保留共享 API 服务、业务服务和 renderer UI 资源。

## 客户端能力

- 多工作区、多会话、本地对话持久化和工作区文件树
- 面向代码任务的 Agent 对话、文件读写、编辑、Shell 执行和权限控制
- 多模型供应商配置、Keychain 密钥管理、Token/缓存命中与费用遥测
- 火山方舟 Seedream 文生图、工作区安全落盘和会话内图片预览
- Todo、Memory、任务图、Skill、MCP、后台任务和周期任务
- Subagent、Agent Teams、Git Worktree 和有边界自治循环
- 可收起导航、工作区概览、Git 改动信息和开发者事件面板
- 结构化运行 Trace：底部四个详情按钮按需展示工具记录、预算、Trace Span 和任务/Worker
  明细，不自动弹出工具面板
- 工具策略：每个工具具备风险分类、权限 scope、Principal 过期校验和独立输出上限
- 任务账本：长任务支持 goal、checkpoint、evidence、幂等键、恢复和 verified 状态
- Worker Queue：独立持久化队列支持 Worker Lease、尝试次数、有限重试和 Dead
  Letter；底部第三行实时展示当前 Job 状态
- Grounded Research：来源新鲜度、质量评分、引用、置信度和证据不足升级；底部任务详情展示研究状态
- MCP 会话管理：按工作区复用已初始化 Session，支持 HTTP、SSE、STDIO Transport、能力协商、取消和关闭
- GitHub Release 检查、下载、退出替换和重新打开的 macOS 自动更新

## 文档

- [产品策划](docs/PRODUCT_PLAN.md)：Agent 客户端定位、目标用户、核心场景、路线图和开源边界。
- [架构说明](docs/ARCHITECTURE.md)：客户端分层、Agent Runtime、Feature、权限、持久化和更新架构。
- [部署与发布](docs/DEPLOYMENT.md)：客户端开发运行、打包、版本号、GitHub Release
  上传和自动更新流程。
- [分阶段课程](stages/README.md)：`s01–s40` 的逐课教程、运行方式、观察重点和练习。

## 源码结构

```text
.
├── src/
│   ├── mod.ts                # Agent 引擎组合入口
│   ├── runtime.ts            # Agent Runtime 主循环
│   ├── features/             # 工具与系统提示 Feature
│   ├── registry.ts           # 工具注册中心
│   ├── prompt.ts             # 系统提示注册与组装
│   ├── permissions.ts        # 权限模式和安全规则
│   ├── context.ts            # 对话上下文压缩
│   ├── scheduler.ts          # 周期性 AI 对话调度
│   ├── config/               # 设置、路径、聊天持久化
│   ├── core/                 # 核心类型
│   └── providers/            # 运行时 Provider 路由、适配器与 usage 遥测
├── electron/
│   ├── main.ts               # Electron 主进程入口
│   ├── preload.ts             # contextBridge preload
│   └── package.json           # Electron Builder 配置
├── desktop/
│   ├── http.ts                # 本地 loopback API
│   ├── services/              # 桌面业务服务
│   └── renderer/              # 原生 HTML/CSS/JS 界面源文件
├── docs/
├── stages/                  # 每课一个目录：README.md + code.ts + images/overview.svg
├── scripts/
├── deno.json
└── dist/
```

`electron/main.ts` 是唯一桌面产品入口，并调用 `src/mod.ts` 中的 Agent 引擎。`stages/`
保留为内部演进和对照示例，不进入正式桌面运行时依赖图。

内部 Agent 引擎按职责拆分为：

- `runtime.ts`：统一 Agent loop、运行预算、重试、Hooks、权限与上下文压缩
- `registry.ts` / `prompt.ts`：工具和系统提示注册
- `features/`：文件工具、生产力、编排、后台任务、Worktree、MCP、定时任务
- `scheduler.ts`：跨平台持久化的周期 AI 对话调度服务

## 开发运行

底层课程和测试要求 Deno 2.9 或更新版本：

```sh
deno --version
deno task check
deno task test
deno task check
```

桌面端也可打开“设置 → 通用 → 课程测试用例”，先查看每课验收项，再单独测试或一键运行全部；该流程使用
Fake Provider，不调用真实模型。

每次桌面对话结束后，回答下方和底部状态栏会显示本次预算的迭代、工具调用、输出字符和成本单位用量；
底部第一行同时显示最近一次模型费用和累计费用。DeepSeek 会根据响应中的 token/cache usage
按已配置的人民币模型价格估算，网关若直接返回 `usage.cost` 则优先采用；未知价格的自定义供应商显示
`—`，避免伪造费用。DeepSeek 供应商还会用当前 API Key 查询余额并显示在状态栏。

`deno task s01` 到 `deno task s40` 用于理解和对照内部演进机制。`s21–s40` 继续覆盖生产级 Agent
所需的运行预算、可靠性、追踪、评估、RAG、规划、MCP 协商、多 Agent
交接、恢复、部署和生产验收。运行桌面应用：

```sh
cd electron
npm install
npm run dev
```

高级教学阶段分为两段：

| 阶段      | 主题               | 最小能力                                           |
| --------- | ------------------ | -------------------------------------------------- |
| `s21–s25` | Runtime 与任务执行 | 预算、Trace、工具策略、Checkpoint、Worker Lease    |
| `s26–s30` | 协议、知识与评估   | MCP Session、A2A、Memory、Grounding、Evaluation CI |
| `s31–s35` | 安全、认知与发布   | Identity/DLP、认知路由、部署拓扑、Canary、验收矩阵 |
| `s36–s40` | 路由、运营与总验收 | Provider、红队、AIOps、证据流、六层 Capstone       |

完整课程地图和每章练习见 [stages/README.md](stages/README.md)。

## 模型配置

首次启动后，在“设置 → 模型”中配置模型供应商。内置 DeepSeek 官方供应商，也可以添加任何
OpenAI-compatible 接口：

```text
供应商名称: DeepSeek 官方
Base URL: https://api.deepseek.com
Models:
  deepseek-v4-flash
  deepseek-v4-pro
```

每个供应商的 API Key 会按 provider id 分开保存到 macOS Keychain。自定义供应商通常只需要填写：

```text
供应商名称: Mini
Base URL: https://api.example.com/v1
Models:
  model-a
  model-b
```

`Base URL` 可以填写 OpenAI-compatible 的根路径；如果误填到
`/chat/completions`，应用会自动归一化为根路径。 远程接口必须使用 HTTPS，本地开发允许
`http://127.0.0.1`、`http://localhost` 或 `http://[::1]`。

运行时按供应商 ID 或名称选择 Provider 适配器。DeepSeek 使用 `providers/deepseek.ts`，MiMo 使用
`providers/mimo.ts`；没有专用适配器的自定义供应商回退到
`providers/openai_compatible.ts`。专用适配器可以在不修改 Agent Runtime 的情况下处理供应商特有的
请求或响应格式。

DeepSeek 仍可通过环境变量提供：

```sh
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

发布构建不会读取或嵌入 `.env.local`。

## 图片生成

在“设置 → 图片生成”中填写火山方舟 API Key 和 Seedream 模型 ID。默认模型为
`doubao-seedream-4-5-251128`，也可以替换为火山方舟控制台当前提供的兼容模型 ID。Key 通过 Electron
`safeStorage` 加密保存，普通设置接口只返回“是否已配置”，不会把明文 Key 发送到 renderer 或写入
`settings.json`。也可通过 `ARK_API_KEY` 环境变量提供凭据。

用户要求生成图片时，Agent 调用 `generate_image` 工具。该操作属于外部调用和工作区写入，在 `ask`
权限模式下会请求确认；生成结果原子写入当前工作区：

```text
.ai-agent/generated-images/
```

桌面端通过受限的 loopback 图片接口显示预览，仅允许当前工作区内不超过 20 MB 的 JPEG、PNG 或 WebP
文件。Seedream 调用固定关闭组图，一次只生成一张，以限制意外费用；1K、2K、4K 每次调用均
计入运行预算的外部成本单位。仓库默认忽略生成图片目录，避免误把大量二进制产物提交到 Git。

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

构建发布包后，可推送 tag 并在 GitHub Release 上传 Electron Builder 产物：

```sh
git tag v1.0.1
git push origin v1.0.1
```

标签名建议使用 `v1.1.0` 或 `ai-agent-v1.1.0`。

应用会从 `tag_name` 中提取语义版本号进行比较，并优先选择名字包含 `AIAgent`、`macos`、`arm64` 的
`.zip` asset 作为自动安装包。zip 根目录需要包含 `AI Agent.app`。

当前测试更新版本为 `1.0.1`，可用 GitHub Release tag `v1.0.1` 验证更新检测链路。

也可以在设置页或环境变量中覆盖更新源：

```sh
AI_AGENT_UPDATE_URL=https://api.github.com/repos/baiyangzuoshu/Learn_AI/releases/latest
```

除 GitHub latest release API 返回的 `tag_name`、`html_url`、`body` 字段外，也支持简单 manifest：

```json
{
  "version": "1.1.0",
  "url": "https://example.com/ai-agent/releases/1.1.0",
  "downloadUrl": "https://example.com/ai-agent/releases/AIAgent-v1.1.0-macos-arm64.zip",
  "notes": "Release notes"
}
```

## 本地数据

| 平台    | 数据目录                                             |
| ------- | ---------------------------------------------------- |
| macOS   | `~/Library/Application Support/AIAgent`              |
| Windows | `%APPDATA%/AIAgent`                                  |
| Linux   | `$XDG_DATA_HOME/AIAgent` 或 `~/.local/share/AIAgent` |

聊天、Memory、任务图和定时任务按工作区隔离。项目路径经 SHA-256 生成本地文件标识。

## MCP

在项目中创建 `.ai-agent/mcp.json`：

```json
{
  "servers": [
    {
      "name": "local-tools",
      "transport": "http",
      "url": "http://127.0.0.1:3000/mcp",
      "enabled": true
    }
  ]
}
```

远程服务仅允许 HTTPS，localhost 可以使用 HTTP；也可以配置 `transport: "stdio"`、`command` 和
`args`。首次列工具或调用时会完成 MCP initialize 和能力协商，同一工作区内复用
Session；实际调用仍受权限模式控制。

### A2A Handoff

第 27 课融合为独立 `handoff` Feature。`handoff_submit` 创建租户隔离、角色明确、Trace
关联的交接目标；`agent_handoff` 以幂等键传递有大小上限的 Artifact 和证据 checkpoint；
`handoff_complete` 只有在持久证据存在时才能完成，`handoff_fail` 记录终态失败原因，`handoff_status`
读取当前工作区的交接状态。 记录按工作区原子持久化，租户不匹配、终态重复迁移、超大
Artifact、缺少证据和取消操作都会被拒绝。

### RAG Memory

第 28 课新增独立 `memory-rag` Feature。`memory_store` 保存 tenant-scoped 的 semantic、episodic 或
procedural 记忆；`memory_search` 在注入上下文前按租户过滤 deleted/expired 记录，进行有界 lexical
检索并返回 `citation`；`memory_tombstone` 保留审计记录但从检索结果移除，`memory_status`
查看保留状态。 写入使用幂等键和原子持久化，旧的 `memory_read`、`memory_append`、`memory_replace`
工具继续兼容，但现在标记为 Deprecated，并转发到 `memory_service` 的 `legacy` 租户。
`memory_migrate_legacy` 可将旧 Markdown 一次性迁移为 Typed Memory。新代码只应使用
`memory_store`、`memory_search` 和 `memory_tombstone`，兼容别名将在迁移完成后的版本中移除。

### Grounded Research

第 29 课融合为独立 `grounded-research` Feature。`research_start` 创建 tenant-scoped、Trace
关联的研究任务； `research_add_source` 只接受 HTTPS（或 localhost
HTTP）的有界来源文本，并记录抓取时间与质量评分； `grounded_research`
按新鲜度、质量和来源覆盖率计算置信度，输出引用，证据不足时将任务置为 `escalated`，不生成猜测答案。
当前服务不进行任意联网抓取，来源必须由已批准的 Connector、MCP 能力或有界 Worker
获取后提交；任务和来源按工作区原子持久化并经过现有权限、Trace、AbortSignal 和输出上限。

## Electron 构建与发布

桌面构建由 Electron Builder 负责打包：

```sh
npm --prefix electron run dist:win
npm --prefix electron run dist:mac
npm --prefix electron run dist:linux
```

也可以分别构建：

```sh
npm --prefix electron run typecheck
npm --prefix electron run build
```

产物目录：

```text
dist/releases/app/
├── AI Agent Setup.exe
├── mac-arm64/AI Agent.app
└── linux/...
```

目标平台：

| 平台                | Electron Builder target | 格式        |
| ------------------- | ----------------------- | ----------- |
| macOS Apple Silicon | `mac`                   | `.app`      |
| macOS Intel         | `mac`                   | `.app`      |
| Windows x64/arm64   | `win`                   | `.exe`      |
| Linux x64/arm64     | `linux`                 | `.AppImage` |

正式分发前仍应在目标系统进行启动、文件选择器、凭据存储、Shell、Git 和窗口生命周期验收，并配置
平台代码签名。

macOS App 图标使用 `desktop/assets/app-icon.icns`，界面品牌图使用
`desktop/assets/app-icon.png`。如果替换图标，需要同步更新这两个文件。

## 验证

```sh
deno fmt --check src desktop README.md AGENTS.md
deno task check
rg 'stages/' desktop src
```

最后一条命令应无输出，证明生产代码没有回退依赖演进示例。

桌面开发版在设置中开启“开发者模式”后，可以查看 Hook、工具、团队、自治、Worktree、MCP 和 Harness
自检事件。

# AI Agent 客户端架构说明

AI Agent 是一个本地优先的开发者 Agent 客户端。桌面端使用 Electron 主进程承载本地服务、
原生能力和窗口，renderer 使用框架无关的 HTML/CSS/JavaScript。

从产品角度看，它是一个桌面客户端：负责工作区、会话、模型配置、工具权限、MCP/Skill 扩展、Git
信息、用量遥测、图片生成和软件更新。从技术角度看，`src/` 根目录的 Runtime 和 Feature 模块组成客户端
内部的 Agent 引擎。

## 设计目标

- 客户端优先：把 Agent 能力组织成可安装、可更新、可长期使用的桌面产品。
- 本地优先：工作区文件、对话、Memory、任务图和定时任务都保存在本机。
- 单一 Agent Loop：所有工具、编排和定时任务共享 `AgentRuntime.run()`。
- 插件化 Agent 引擎：新增能力通过 Feature 注册工具和系统提示，不修改运行时核心。
- 权限可控：文件、Shell、后台任务和外部工具调用都经过权限模式与硬拒绝规则。
- 生产与演进示例隔离：`stages/` 只做机制对照，生产代码不能 import `stages/`。
- 桌面 UI 极简：`desktop/renderer/` 使用原生 HTML、CSS、JavaScript。

## 客户端边界

AI Agent 客户端由四层组成：

1. 桌面壳层：窗口、导航、输入框、工作区面板、设置、更新。
2. 本地后端：HTTP API、静态资源服务、工作区文件/Git/设置/会话 API。
3. Agent 引擎：上下文、系统提示、工具注册、权限、工具执行、编排和调度。
4. 外部连接：模型 Provider、Seedream 图片服务、MCP 服务、GitHub Releases、系统安全存储和 Shell。

客户端不托管云服务，不保存云端账号体系，不提供模型训练能力。

## 总体分层

```text
用户输入
  ↓
desktop/renderer/           原生桌面 UI
  ↓ HTTP / NDJSON stream
electron/main.ts            Electron 组装入口
  ├── desktop/http.ts       HTTP API 路由
  └── desktop/services/     工作区、Git、更新和 Chat 服务
  ↓
src/mod.ts                  Agent 引擎组合入口
  ↓
src/runtime.ts              Agent loop、权限、上下文、Hooks、工具执行
  ├── src/features/         工具与系统提示 Feature
  ├── src/providers/        模型 Provider
  └── src/config/           设置、密钥、对话、工作区和本地路径
```

## 目录结构

```text
.
├── electron/
│   ├── main.ts              # 产品进程入口：窗口、原生能力和 HTTP 服务
│   ├── preload.ts           # contextBridge 安全桥接
│   └── package.json          # Electron Builder 配置
├── desktop/
│   ├── http.ts               # HTTP API 路由
│   ├── services/             # 工作区、Git、更新和 Chat 服务
│   └── renderer/             # 无框架桌面 UI 源文件
├── src/
│   ├── core/                # Message、ToolDefinition 等核心类型
│   ├── config/              # 设置、密钥、工作区、会话持久化、跨平台路径
│   ├── providers/           # 对话 Provider、Seedream 和 usage telemetry
│   ├── mod.ts               # Agent 引擎组合根和对外入口
│   ├── runtime.ts           # AgentRuntime 主循环
│   ├── registry.ts          # 工具注册中心
│   ├── prompt.ts            # 系统提示注册与组装
│   ├── permissions.ts       # 权限模式和安全规则
│   ├── context.ts           # 对话上下文压缩
│   ├── scheduler.ts         # 周期性 AI 对话调度
│   └── features/            # 可拆卸 Feature 模块
├── stages/                  # 每课一个 README.md + code.ts，不进入生产依赖图
├── scripts/                 # 本地发布脚本
├── docs/                    # 开源文档
├── deno.json                # 课程和底层测试任务
└── dist/                    # 构建产物
```

## 产品入口

`electron/main.ts` 是唯一产品入口。它负责：

- 创建 Electron `BrowserWindow` 桌面窗口。
- 启动 loopback HTTP 服务并加载 `desktop/renderer/` 静态资源。
- 提供 HTTP API，例如：
  - `/api/chat`、`/api/chat/stream`
  - `/api/settings`
  - `/api/conversations`
  - `/api/workspace/tree`
  - `/api/workspace/image`（工作区内生成图片的受限预览）
  - `/api/workspace/git`
  - `/api/file/open`
  - `/api/cron`、`/api/cron/run`
  - `/api/telemetry`（Token、缓存命中和费用遥测）
  - `/api/balance`（使用现有 Provider API Key 查询余额）
  - `/api/tests/lessons`（课程 Smoke Test）
  - `/api/update/check`
  - `/api/update/install`
- 调用 `src/mod.ts` 暴露的 `agentLoop()`。
- 管理软件更新检查、下载、退出替换和重启。

桌面关闭时进程会主动退出，避免本地 HTTP 服务继续保持后台进程。

## Agent 引擎组合入口

`src/mod.ts` 是生产 Agent 引擎的组合根：

```ts
export const harness = new AgentRuntime([
  diagnostics,
  runtimeLimits,
  pdfReader,
  coreTools,
  productivity,
  orchestration,
  integrations,
  imageGeneration,
  scheduling,
]);
```

它导出两层入口：

- `runAgent`：绑定后的底层 `harness.run()`，适合需要完整 `RunOptions` 的调用方。
- `agentLoop()`：面向 UI 的简化入口，负责把内部 Agent event 转成 UI 需要的事件。

## Agent Runtime

`AgentRuntime` 是系统核心。一次用户请求的大致流程：

```text
RunOptions
  ↓
解析工作区、模型、权限模式
  ↓
压缩历史上下文
  ↓
组装系统提示
  ↓
调用模型
  ├─ 返回 tool_calls → 权限检查 → 执行工具 → 追加工具结果 → 继续循环
  └─ 返回文本       → 结束循环，返回回答
```

运行时统一处理：

- 模型调用和指数退避重试。
- `AbortSignal` 取消传播。
- 每次运行的迭代、工具调用、输出量和成本预算。
- 嵌套 Agent 的子预算，以及预算耗尽时的开发者 Hook 事件。
- 工具执行和工具结果回填。
- 用户可见工具事件与开发者 Hook 事件。
- 权限检查和危险操作拒绝。
- 上下文压缩和历史消息控制。

### 结构化 Trace

第 22 课的契约与追踪机制已融合到生产 Runtime。每次 `AgentRuntime.run()` 创建一个 root span，Provider
调用和工具执行创建带有 `traceId`、`spanId`、`parentSpanId` 的子
Span；成功、失败和取消都会记录状态与耗时。 `TraceSummary` 输出脱敏的聚合信息以及 Span 元数据：Trace
ID、总耗时、Span 数、Provider 调用数、工具调用数、错误数和父子 Span 关系。Span 明细不包含提示词、API
Key、工具参数、工具输出或文件内容。

桌面底部状态栏第一行固定展示模型、工作区、Token、费用和会话信息，不再追加新功能；预算和 Trace
位于第二行， 后续指标继续使用独立的 `runtime-status-row` 向下扩展。完整工具事件仍在工具面板中，详细
Hook 事件只在开发者 模式下显示。Trace 不持久化提示词、API Key、工具参数或文件内容。

## Feature 模块

每个 Feature 通过统一接口注册工具和提示：

```ts
interface HarnessFeature {
  id: string;
  register(context: {
    tools: ToolRegistryContract;
    prompts: PromptRegistryContract;
    run: (options: RunOptions) => Promise<string>;
  }): void;
}
```

当前生产 Feature：

| Feature            | 职责                                           |
| ------------------ | ---------------------------------------------- |
| `diagnostics`      | Agent 引擎自检和能力状态                       |
| `runtime_limits`   | 统一运行预算、取消边界和嵌套执行子预算         |
| `pdf_reader`       | 在工作区内提取 PDF 文本和元数据                |
| `core_tools`       | Shell、读文件、写文件、编辑文件                |
| `productivity`     | Todo、Memory、任务图、Skill 加载               |
| `orchestration`    | Subagent、Team、Autonomous bounded loop        |
| `integrations`     | 后台任务、Git Worktree、MCP 工具发现与调用     |
| `image_generation` | 调用 Seedream 生成图片并安全写入工作区         |
| `scheduling`       | 周期性 AI 对话任务的 list、write、run-now 工具 |

新增工具时优先新增或扩展 Feature，而不是把业务逻辑塞进 `runtime.ts`。

桌面端的“设置 → 通用 → 1–21 课程测试用例”会调用 `/api/tests/lessons`，展示并执行 1–21 课程的生产能力
Smoke Test；第 21 课继续调用 `tests/21test_runtime_budget.ts` 中的 Fake Provider
预算验收。生产测试另外覆盖 Provider 费用遥测和 Seedream 请求边界。

### 图片生成

`image_generation` Feature 注册 `generate_image` 工具。工具只接受提示词、`1K`/`2K`/`4K`
尺寸和水印开关， 固定请求单张图片，调用火山方舟 Seedream 的 `/images/generations` 接口，并把返回的
JPEG、PNG 或 WebP 原子写入当前工作区的
`.ai-agent/generated-images/`。生成属于外部调用和工作区写入，在 `ask` 权限模式下
需要确认；图片大小上限为 20 MB。

桌面端通过 `/api/workspace/image` 提供预览，但后端会校验当前工作区、文件类型和 20 MB 大小上限。图片
API Key 不进入 `settings.json` 或 renderer 状态，公开设置只返回 `hasApiKey`。

### Provider 路由

对话 Provider 由 `src/providers/registry.ts` 按 Provider ID 或名称选择：DeepSeek 和 MiMo
使用专用适配器， 其他供应商回退到 OpenAI-compatible 适配器。Provider 配置、模型列表和默认模型由
`src/config/settings.ts` 归一化，API Key 通过平台安全存储读取。Seedream 是独立的图片
Provider，不进入对话 Provider 的路由。

## 权限与安全边界

权限模式：

- `ask`：写操作或危险操作前询问。
- `auto`：自动批准普通工作区内操作，但仍保留安全规则。
- `full`：用户显式选择后放开更多操作。

权限检查发生在 `AgentRuntime` 执行每个 tool call
之前。`generate_image`、文件写入、后台任务、Worktree、 MCP 调用和调度写入属于外部或持久化操作；危险
Shell 命令还会经过硬拒绝规则。取消运行时使用同一个 `AbortSignal` 传递到 Provider、工具和流式响应。

关键边界：

- 文件路径必须限制在当前工作区内。
- 生产代码不能依赖 `stages/`。
- 远程 MCP 只允许 HTTPS；localhost 开发可以使用 HTTP。
- API key 不进入 release 包，不提交 `.env.local`。
- GitHub Release 自动更新必须使用匿名可访问的公开 Release 资产。
- 本地 HTTP 服务只监听 loopback；请求体在 API 边界解析后再进入设置、工作区和 Agent 服务。

## 持久化

跨平台数据目录由 `src/config/paths.ts` 统一管理：

| 平台    | 数据目录                                             |
| ------- | ---------------------------------------------------- |
| macOS   | `~/Library/Application Support/AIAgent`              |
| Windows | `%APPDATA%/AIAgent`                                  |
| Linux   | `$XDG_DATA_HOME/AIAgent` 或 `~/.local/share/AIAgent` |

Provider 遥测除了调用次数、Token 和缓存命中数，也记录最近一次费用与累计费用。DeepSeek
根据模型和响应中的 cache hit/miss、输入、输出 token 做本地费用估算；如果 OpenAI-compatible 网关返回
`usage.cost`，则优先使用网关值；内置 DeepSeek
费用按人民币价格记录。没有已知价格的自定义供应商保持未知， 不显示误导性的零费用。DeepSeek
余额通过后端携带现有 API Key 调用 `/user/balance`，只返回余额字段， 不向前端暴露 Key。

持久化内容：

- 设置和工作区列表。
- 对话历史。
- Memory 和任务图。
- 周期性 AI 对话任务。
- Provider usage telemetry。

Electron 主进程使用 `safeStorage` 加密 Provider 和图片 API Key，并把加密值写入用户数据目录的 secrets
文件； macOS 上 `safeStorage` 使用系统安全存储能力。环境变量仅作为开发 fallback。普通
`/api/settings` 响应只返回 `hasApiKey`，不会返回明文 Key。

## 桌面 UI

`desktop/renderer/` 是无框架 UI：

- `index.html`：页面结构和设置面板。
- `app.js`：状态管理、API 调用、流式消息、工作区面板、更新按钮。
- `styles.css`、`layout.css`、`settings.css` 等：按功能拆分样式。
- `stream.css`、`subagent.css`、`todo.css`、`skill.css`、`developer.css`：流式输出、编排、生产力、Skill
  和开发者面板样式。

UI 设计约束：

- 消息区滚动时输入框固定。
- 用户向上阅读时不强制回到底部。
- 左侧导航和右侧工作区可收起。
- 工作区面板提供概览、文件树、Git 改动信息。
- 开发者事件默认隐藏，只在开发者模式下展示。

## 软件更新架构

更新检查读取 GitHub latest release API 或自定义 manifest：

```text
https://api.github.com/repos/baiyangzuoshu/Learn_AI/releases/latest
```

更新流程：

```text
检查最新 Release
  ↓
比较 tag_name / version 与 APP_VERSION
  ↓
选择 macOS arm64 zip asset
  ↓
下载 zip 到临时目录
  ↓
生成后台安装脚本
  ↓
退出当前 App
  ↓
替换 .app
  ↓
重新打开 App
```

GitHub Release 必须公开可访问。私有仓库的未授权 latest release API 通常返回 404。

Electron Builder 的 `dist:win` 生成 Windows 安装包，`dist:linux` 生成 AppImage，`dist:mac` 默认生成
macOS arm64 的 `.app` 目录；用于自动更新的 macOS ZIP 必须以 `AI Agent.app`
作为根目录内容。发布构建只打包 `electron/dist` 和 `package.json`，不包含 `src/`、`stages/`
或开发环境文件。

## 生产验证

架构相关修改完成后至少运行：

```sh
deno fmt --check src desktop README.md AGENTS.md
deno task check
deno task test
rg 'stages/' src desktop
npm --prefix electron run dist:win
npm --prefix electron run dist:mac
npm --prefix electron run dist:linux
```

`rg 'stages/' src desktop` 应无输出。

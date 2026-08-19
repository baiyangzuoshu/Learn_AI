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

桌面底部状态栏第一行固定展示模型、工作区、Token、费用和会话信息，不再追加新功能；其下改为四个
详情按钮：工具记录、预算、Trace 和任务 /
Worker。按钮点击后才展开对应内容，工具执行记录不会自动弹出； 详细 Hook
事件只在开发者模式下显示。Trace 不持久化提示词、API Key、工具参数或文件内容。

### Tool Policy

第 23 课的 Tool Policy 已融合到生产工具执行面。`ToolRegistry` 为每个注册工具保存统一策略：风险分类
（read-only、mutating、external、dangerous）、mutation 标记、所需 scope
和最大输出长度。运行开始时创建短期 `Principal`；每次工具调用在权限审批前检查 Principal
是否过期、是否拥有全部 scope，执行成功后再按工具策略截断 输出。策略拒绝、授权和输出截断会通过开发者
Hook 与 Trace 关联，模型不能自行授予或延长权限。

未显式传入策略的旧工具会由注册中心按工具名称生成安全默认值，以保持现有 Feature
兼容；新增高风险工具应显式传入 `ToolPolicy`，并补充过期、scope、输出上限和失败路径的验收测试。

### Task State & Replay

第 24 课的任务账本已融合为独立 `task-state` Feature。`task_create`、`task_checkpoint`、`task_resume`
和 `task_verify` 使用工作区哈希后的本地 JSON
文件持久化任务状态；写入通过原子替换完成。任务只有在存在 evidence 时才能进入 `verified`，checkpoint
和 verify 支持幂等键，重复提交不会重复推进副作用。每次任务工具 返回的状态会关联当前
Trace，并推送到桌面底部“任务 / Worker”详情面板；该面板显示任务 ID、状态、revision、证据数量和目标。
Trace 明细通过独立的“追踪”按钮查看。

### Worker Queue、Lease 与 Dead Letter

第 25 课在任务账本之上新增独立 `worker-queue` Feature。`worker_enqueue` 将小型、可幂等的 payload
写入按工作区隔离的本地 JSON 队列；`worker_lease` 以 worker identity 原子领取一个到期 Job，Lease
到期后会自动回收；`worker_settle` 显式提交成功或失败，失败使用有上限的指数退避重试，达到
`max_attempts` 后进入 `dead`（Dead Letter）状态。`worker_status` 用于读取队列和当前
Job。队列写入使用原子替换，Job 数量、payload、Lease 时长和尝试次数均有边界，避免后台任务无限增长。

Worker 工具输出会关联当前 Trace，并作为 `WorkerState` 事件推送到桌面底部“任务 /
Worker”详情面板。该面板 独立于任务账本，展示当前 Worker Job 的 Lease
剩余时间、`attempts/max_attempts`、重试等待状态和 Dead Letter
状态；第一行继续保持模型、工作区、Token、费用和会话信息不变。

### MCP Session 与 Transport

第 26 课已融合为 MCP 会话管理层。`src/mcp.ts` 将 Transport（HTTP、SSE、STDIO）与 Session 生命周期
分离：首次 `mcp_list_tools` 或 `mcp_call` 会发送 `initialize` 并记录协商结果，后续同一工作区和
Server 复用 Session；Server 配置变化会关闭旧 Transport 并重新协商。所有请求继续传播
`AbortSignal`，HTTP 只允许 HTTPS 或 localhost，响应限制为 2 MB；STDIO 使用 Content-Length
framing，限制 stderr，并在进程退出时拒绝挂起请求。

`mcp_servers` 只返回脱敏配置，`mcp_list_tools` 和 `mcp_call` 通过 `McpSessionManager` 执行，新增
`mcp_status` 读取当前工作区的初始化状态和 capabilities。Electron 退出前统一调用
`shutdownMcpSessions()`，关闭所有 HTTP / STDIO Session，避免遗留子进程。工具仍经过现有 Tool
Policy、权限审批、Trace 和输出上限；生产代码不直接导入课程文件。

### A2A Handoff

第 27 课由 `src/handoff.ts` 和独立 `handoff` Feature 实现。`handoff_submit` 创建 tenant-scoped、
role-aware、trace-linked 的目标；`agent_handoff` 通过幂等键追加有上限的 Artifact 与 evidence
checkpoint；`handoff_complete` 仅允许带有持久证据的 `running` 记录进入 `complete`，`handoff_fail`
记录终态失败原因，`handoff_status` 只返回当前工作区中指定租户可见的记录。文件按工作区 SHA-256
分片并原子替换，写操作使用
工作区锁串行化；租户不匹配、终态重复迁移、超大产物、缺少证据和取消请求都会被拒绝。工具输出中的
handoff 状态会作为 `HandoffState` Hook 推送到桌面底部“任务 / Worker”详情面板。

### RAG Memory

第 28 课由 `src/memory_service.ts` 和独立 `memory-rag` Feature 实现。`memory_store` 保存
tenant-scoped 的 `semantic`、`episodic`、`procedural` 记录；`memory_search` 在有限结果集上执行
lexical 检索，排除其他租户、tombstone 和过期记录，并为每条结果返回 citation。`memory_tombstone`
执行可审计删除，`memory_status` 读取保留状态。记录按工作区 SHA-256 分片并原子替换，写入支持幂等键和
工作区锁；工具通过现有权限、AbortSignal、Trace 和输出上限。当前检索模式明确标记为
`lexical`，后续可在 同一契约下替换向量索引或 reranker，不能把课程中的占位 embedding
当作生产质量保证。旧的 `memory_read`、`memory_append`、`memory_replace` 已标记 Deprecated，并通过
`legacy` tenant 转发到同一 Service；`memory_migrate_legacy` 把旧 Markdown 原子迁移为 Typed Memory。
生产模块和新提示只使用
`memory_store`、`memory_search`、`memory_tombstone`，兼容别名在迁移窗口结束后移除。

### Grounded Research

第 29 课由 `src/research_service.ts` 和 `grounded-research` Feature 实现，形成独立的
`planned → collecting → complete/escalated` 研究状态机。`research_start` 保存 tenant、query、Trace、
来源上限、新鲜度窗口和最低置信度；`research_add_source` 校验 HTTPS（localhost 可用
HTTP）、限制文本大小， 并记录 `fetchedAt` 与 `quality`；`grounded_research`
只使用新鲜且质量不低于阈值的来源，计算有界置信度并返回 URL
citations。证据不足、来源过期或质量不够时保留任务并升级，不输出未经引用的事实。服务不自行访问任意网络，
来源由批准的 Connector、MCP 或 Worker
提供；持久化按工作区分片、原子替换和锁串行化，租户隔离、幂等键、 AbortSignal、权限策略、Trace
和输出上限沿用现有 Runtime 契约。

### Evaluation CI

第 30 课由 `src/evaluation_service.ts` 和 `evaluation-ci` Feature 实现。`evaluation_gate` 接收
tenant、dataset version、受限 EvalCase 集合与候选输出，计算 exact correctness、citation
grounding、review queue 和 `passed/blocked` 发布状态；默认质量与引用阈值均为
0.95，任一指标回归都会阻断 Gate。记录按工作区分片原子 持久化，支持 Trace、幂等重跑、租户隔离和
`evaluation_status` 查询。该 Feature 是确定性评分器，不会在工具内
隐式发起模型或网络调用；生产流水线应额外提交安全负例、延迟、成本、flaky 重跑和人工复核证据，再由 CI
决定晋级。

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

| Feature             | 职责                                              |
| ------------------- | ------------------------------------------------- |
| `diagnostics`       | Agent 引擎自检和能力状态                          |
| `runtime_limits`    | 统一运行预算、取消边界和嵌套执行子预算            |
| `pdf_reader`        | 在工作区内提取 PDF 文本和元数据                   |
| `core_tools`        | Shell、读文件、写文件、编辑文件                   |
| `productivity`      | Todo、Memory、任务图、Skill 加载                  |
| `orchestration`     | Subagent、Team、Autonomous bounded loop           |
| `integrations`      | 后台任务、Git Worktree、MCP Session 与 Transport  |
| `image_generation`  | 调用 Seedream 生成图片并安全写入工作区            |
| `task-state`        | 任务账本、checkpoint、evidence、恢复和验证        |
| `worker-queue`      | Worker Queue、Lease、重试和 Dead Letter           |
| `handoff`           | 租户隔离、Trace 关联、证据和幂等的 A2A 交接       |
| `memory-rag`        | 类型化记忆、租户检索、引用和 tombstone            |
| `grounded-research` | 研究任务、来源质量/新鲜度、引用、置信度和升级     |
| `evaluation-ci`     | 版本化评估、正确率、引用覆盖、复核队列和发布 Gate |
| `security-boundary` | 身份、租户/scope、出口、SSRF、DLP 和安全审计      |
| `scheduling`        | 周期性 AI 对话任务的 list、write、run-now 工具    |

新增工具时优先新增或扩展 Feature，而不是把业务逻辑塞进 `runtime.ts`。

桌面端的“设置 → 通用 → 课程测试用例”会调用 `/api/tests/lessons`，展示并执行生产能力 Smoke Test；第
21 课继续调用 `tests/21test_runtime_budget.ts` 中的 Fake Provider 预算验收，课程 27 额外验收 A2A
Handoff 工具注册和终态约束，课程 28 验收 RAG Memory 工具注册。生产测试另外覆盖 Provider 费用遥测和
Seedream 请求边界，课程 29 验收 Grounded Research 工具注册、引用和证据不足升级。 课程 30 验收
Evaluation CI 工具注册、通过 Gate、回归阻断和复核队列。

### Security Boundary

第 31 课由 `src/security_boundary.ts` 与 `security-boundary` Feature 实现。Runtime 将短期 Principal
传入 `ToolContext`，工具在外部动作前检查 subject、tenant、expiresAt 与所需 scope；出口只允许 HTTPS
或 localhost HTTP，拒绝 URL 中的凭据、loopback/私有/链路本地/多播 IP 等 SSRF 目标。`redactSecrets`
在文本返回和审计前 移除 API Key、Bearer Token、密码和 Secret；允许与拒绝决策按工作区原子持久化并由
`security_audit` 查询。 该边界与已有 Tool Policy、权限审批、工作区路径 sandbox、Trace 和 AbortSignal
叠加，安全失败默认阻断， 不能由模型自行授予 scope 或延长 Principal。

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
- Worker Queue（按工作区哈希隔离的队列 JSON，原子写入）。
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

# Deno Agent 客户端架构说明

Deno Agent 是一个本地优先的开发者 Agent 客户端。它使用 Deno Desktop 和系统 WebView 承载界面，不引入
Electron、Node.js 运行时或 Rust 应用层。

从产品角度看，它是一个桌面客户端：负责工作区、会话、模型配置、工具权限、MCP/Skill 扩展、Git
信息、用量遥测和软件更新。从技术角度看，`src/harness/` 是客户端内部的 Agent 引擎。

## 设计目标

- 客户端优先：把 Agent 能力组织成可安装、可更新、可长期使用的桌面产品。
- 本地优先：工作区文件、对话、Memory、任务图和定时任务都保存在本机。
- 单一 Agent Loop：所有工具、编排和定时任务共享 `AgentRuntime.run()`。
- 插件化 Agent 引擎：新增能力通过 Feature 注册工具和系统提示，不修改运行时核心。
- 权限可控：文件、Shell、后台任务和外部工具调用都经过权限模式与硬拒绝规则。
- 生产与演进示例隔离：`stages/` 只做机制对照，生产代码不能 import `stages/`。
- 桌面 UI 极简：`desktop/renderer/` 使用原生 HTML、CSS、JavaScript。

## 客户端边界

Deno Agent 客户端由四层组成：

1. 桌面壳层：窗口、导航、输入框、工作区面板、设置、更新。
2. 本地后端：HTTP API、静态资源服务、工作区文件/Git/设置/会话 API。
3. Agent 引擎：上下文、系统提示、工具注册、权限、工具执行、编排和调度。
4. 外部连接：模型 Provider、MCP 服务、GitHub Releases、系统 Keychain 和 Shell。

客户端不托管云服务，不保存云端账号体系，不提供模型训练能力。

## 总体分层

```text
用户输入
  ↓
desktop/renderer/           原生桌面 UI
  ↓ HTTP / NDJSON stream
desktop/main.ts             Deno Desktop 后端、HTTP API、静态资源、更新服务
  ↓
src/harness/mod.ts          Agent 引擎组合入口
  ↓
src/harness/runtime.ts      Agent loop、权限、上下文、Hooks、工具执行
  ├── src/harness/features/ 工具与系统提示 Feature
  ├── src/providers/        模型 Provider
  └── src/config/           设置、密钥、对话、工作区和本地路径
```

## 目录结构

```text
.
├── desktop/
│   ├── main.ts              # 产品进程入口：窗口、HTTP API、静态资源、更新接口
│   └── renderer/            # 无框架桌面 UI
├── src/
│   ├── core/                # Message、ToolDefinition 等核心类型
│   ├── config/              # 设置、Keychain、工作区、会话持久化、跨平台路径
│   ├── providers/           # DeepSeek API 客户端与 usage telemetry
│   └── harness/             # Agent 引擎生产实现
│       ├── mod.ts           # Agent 引擎组合根和对外入口
│       ├── runtime.ts       # AgentRuntime 主循环
│       ├── registry.ts      # 工具注册中心
│       ├── prompt.ts        # 系统提示注册与组装
│       ├── permissions.ts   # 权限模式和安全规则
│       ├── context.ts       # 对话上下文压缩
│       ├── scheduler.ts     # 周期性 AI 对话调度
│       └── features/        # 可拆卸 Feature 模块
├── stages/                  # 演进示例，不进入生产依赖图
├── scripts/                 # 本地发布脚本
├── docs/                    # 开源文档
├── deno.json                # 任务、构建 target、Deno Desktop 配置
└── dist/                    # 构建产物
```

## 产品入口

`desktop/main.ts` 是唯一产品入口。它负责：

- 创建 `Deno.BrowserWindow` 桌面窗口。
- 读取并内嵌 `desktop/renderer/` 静态资源。
- 提供 HTTP API，例如：
  - `/api/chat`、`/api/chat/stream`
  - `/api/settings`
  - `/api/conversations`
  - `/api/workspace/tree`
  - `/api/workspace/git`
  - `/api/telemetry`
  - `/api/update/check`
  - `/api/update/install`
- 调用 `src/harness/mod.ts` 暴露的 `agentLoop()`。
- 管理软件更新检查、下载、退出替换和重启。

桌面关闭时进程会主动退出，避免 `Deno.serve()` 继续保持后台进程。

## Agent 引擎组合入口

`src/harness/mod.ts` 是生产 Agent 引擎的组合根：

```ts
export const harness = new AgentRuntime([
  diagnostics,
  coreTools,
  productivity,
  orchestration,
  integrations,
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
- 工具执行和工具结果回填。
- 用户可见工具事件与开发者 Hook 事件。
- 权限检查和危险操作拒绝。
- 上下文压缩和历史消息控制。

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

| Feature         | 职责                                           |
| --------------- | ---------------------------------------------- |
| `diagnostics`   | Agent 引擎自检和能力状态                       |
| `core_tools`    | Shell、读文件、写文件、编辑文件                |
| `productivity`  | Todo、Memory、任务图、Skill 加载               |
| `orchestration` | Subagent、Team、Autonomous bounded loop        |
| `integrations`  | 后台任务、Git Worktree、MCP 工具发现与调用     |
| `scheduling`    | 周期性 AI 对话任务的 list、write、run-now 工具 |

新增工具时优先新增或扩展 Feature，而不是把业务逻辑塞进 `runtime.ts`。

## 权限与安全边界

权限模式：

- `ask`：写操作或危险操作前询问。
- `auto`：自动批准普通工作区内操作，但仍保留安全规则。
- `full`：用户显式选择后放开更多操作。

关键边界：

- 文件路径必须限制在当前工作区内。
- 生产代码不能依赖 `stages/`。
- 远程 MCP 只允许 HTTPS；localhost 开发可以使用 HTTP。
- API key 不进入 release 包，不提交 `.env.local`。
- GitHub Release 自动更新必须使用匿名可访问的公开 Release 资产。

## 持久化

跨平台数据目录由 `src/config/paths.ts` 统一管理：

| 平台    | 数据目录                                                 |
| ------- | -------------------------------------------------------- |
| macOS   | `~/Library/Application Support/DenoAgent`                |
| Windows | `%APPDATA%/DenoAgent`                                    |
| Linux   | `$XDG_DATA_HOME/DenoAgent` 或 `~/.local/share/DenoAgent` |

持久化内容：

- 设置和工作区列表。
- 对话历史。
- Memory 和任务图。
- 周期性 AI 对话任务。
- Provider usage telemetry。

macOS 上 DeepSeek API Key 优先存入 Keychain；环境变量可作为开发 fallback。

## 桌面 UI

`desktop/renderer/` 是无框架 UI：

- `index.html`：页面结构和设置面板。
- `app.js`：状态管理、API 调用、流式消息、工作区面板、更新按钮。
- `styles.css`、`layout.css`、`settings.css` 等：按功能拆分样式。

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

## 生产验证

架构相关修改完成后至少运行：

```sh
deno fmt --check src/harness desktop/main.ts README.md AGENTS.md
deno task check
rg 'stages/' src desktop
deno task desktop:build:mac-arm64
```

`rg 'stages/' src desktop` 应无输出。

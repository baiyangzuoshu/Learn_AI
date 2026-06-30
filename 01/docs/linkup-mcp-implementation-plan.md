# LinkUpClient MCP 详细实施与验收计划

> 文档状态：待评审 / 未实施  
> 版本：1.0  
> 日期：2026-06-30  
> 对应总阶段：G3；G4 为条件扩展  
> 目标目录：`01/mcp/linkup-dev-mcp`  
> 前置条件：G1 Tools、G2 Skill 已独立验收通过

## 1. 目标

实现一个本地、只读、最小权限的 LinkUpClient MCP Server，将已经验证的项目分析能力以标准 MCP 接口提供给 Agent Host。

第一版完成以下闭环：

```text
Agent Host
→ MCP Client
→ linkup-dev-mcp（stdio）
→ linkup-check 库 / 项目契约索引
→ 结构化结果
→ Agent Host
```

第一版不是 Runtime Inspector，也不是通用文件服务器。

## 2. 范围

### 2.1 G3 必须实现

- 本地 stdio MCP Server。
- MCP 生命周期与能力协商。
- 三个只读 Tools：
  - `validate_project`
  - `inspect_ui_prefab`
  - `resolve_ui_contract`
- 四个只读 Resources：
  - `linkup://project/profile`
  - `linkup://project/architecture`
  - `linkup://rules/ui-contracts`
  - `linkup://validation/rules`
- JSON Schema 输入、输出验证。
- `structuredContent` 与文本兼容输出。
- 项目根目录锁定和路径边界检查。
- 单元、集成、协议、契约和安全测试。
- MCP Inspector 或等价客户端验证证据。

### 2.2 G3 明确不实现

- 通用 `read_file`、`write_file`。
- 通用 shell 或进程执行。
- 网络请求、浏览器控制。
- Cocos Runtime 节点树、日志、截图。
- Prompts、Sampling、Elicitation、Tasks。
- Streamable HTTP。
- OAuth 或远程部署。
- 自动修复和业务文件写入。

### 2.3 G4 条件扩展

G3 验收后，只有真实任务证明需要运行态观察时，才评估 Runtime Adapter：

- `runtime_status`
- `runtime_scene_tree`
- `runtime_node_detail`
- `runtime_console_logs`
- `runtime_capture_preview`
- 可选 `runtime_pause/resume/reload`

G4 不属于第一版默认交付。

## 3. 协议基线

计划编写时核对的官方规范版本为 `2025-06-18`。实施 AI 开始 G3 时必须重新检查官方规范和 SDK 当前稳定版本，并在 ADR 中记录实际采用版本。

采用的协议原则：

- MCP 使用 JSON-RPC 2.0 数据层。
- Server 暴露 Tools 和 Resources。
- Tools 通过 `inputSchema` 描述输入。
- Tools 提供 `outputSchema`，返回符合 schema 的 `structuredContent`。
- 为兼容客户端，结构化结果同时序列化到 TextContent。
- 输入参数错误使用协议错误。
- 业务执行失败使用 Tool Result 的 `isError: true`。
- 本地 Server 使用 stdio；stdout 仅允许协议消息，日志写 stderr。

参考：

- https://modelcontextprotocol.io/docs/learn/architecture
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices

## 4. 前置交付契约

G3 不得直接解析 LinkUpClient 全部细节。它依赖 G1 提供的公开库接口。

要求 `linkup-check` 至少导出：

```ts
export interface RunChecksOptions {
  projectRoot: string;
  ruleIds?: string[];
  baselinePath?: string;
}

export interface Diagnostic {
  ruleId: string;
  severity: "error" | "warning" | "info";
  file: string;
  line?: number;
  subject?: string;
  message: string;
  suggestion?: string;
  fingerprint: string;
  baselined: boolean;
}

export interface CheckResult {
  diagnostics: Diagnostic[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    baselined: number;
    passedRules: number;
  };
}

export function runChecks(options: RunChecksOptions): Promise<CheckResult>;
```

同时要求一个只读项目索引接口：

```ts
export interface ProjectIndex {
  projectRoot: string;
  projectVersion?: string;
  uiNames: string[];
  prefabs: Map<string, PrefabSummary>;
  controllers: Map<string, ControllerSummary>;
  registrations: UiRegistration[];
}

export function buildProjectIndex(projectRoot: string): Promise<ProjectIndex>;
```

如果 G1 实际接口不同，G3 只能添加薄适配器，不能复制规则实现。

## 5. 目录设计

```text
01/mcp/linkup-dev-mcp/
├── package.json
├── package-lock.json
├── tsconfig.json
├── linkup-mcp.config.json
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── config.ts
│   ├── logger.ts
│   ├── errors.ts
│   ├── project-context.ts
│   ├── schemas/
│   │   ├── common.ts
│   │   ├── validate-project.ts
│   │   ├── inspect-ui-prefab.ts
│   │   └── resolve-ui-contract.ts
│   ├── tools/
│   │   ├── validate-project.ts
│   │   ├── inspect-ui-prefab.ts
│   │   └── resolve-ui-contract.ts
│   ├── resources/
│   │   ├── project-profile.ts
│   │   ├── project-architecture.ts
│   │   ├── ui-contracts.ts
│   │   └── validation-rules.ts
│   └── runtime/                    # G4 获批前不创建实现
│       └── runtime-adapter.ts      # G4 才允许
└── test/
    ├── fixtures/
    ├── unit/
    ├── integration/
    ├── protocol/
    ├── security/
    └── contract/
```

G3 实施时不创建空的 Runtime 目录占位；目录树中的 Runtime 仅表示后续目标。

## 6. 技术栈与依赖

### 6.1 运行环境

- Node.js：实施时记录实际最低版本。
- TypeScript。
- ESM。
- 官方 MCP TypeScript SDK 稳定版。
- Schema 库仅使用 SDK 推荐或已包含方案。
- 测试优先使用 `node:test`；如果 SDK 测试需要额外 runner，必须说明原因。

### 6.2 依赖规则

- 锁定直接依赖版本。
- 提交 `package-lock.json`。
- 不使用 `latest` 范围。
- 不引入 Web 框架。
- 不引入文件 glob 库，除非标准库不足且有测试收益。
- 依赖安装前获得网络与写入授权。
- 记录依赖许可证和用途。

### 6.3 建议 scripts

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --test dist/test/**/*.test.js",
    "start": "node dist/src/index.js"
  }
}
```

实施 AI 可调整路径，但必须保留等价命令，并同步本文验收记录。

## 7. 配置设计

配置文件：

```json
{
  "projectRoot": "../../LinkUpClient",
  "baselinePath": "../../tools/linkup-check/linkup-check.baseline.json",
  "maxTreeDepth": 8,
  "maxTreeNodes": 2000,
  "maxDiagnostics": 500,
  "logLevel": "info"
}
```

规则：

- `projectRoot` 只在进程启动时读取。
- Tool 参数不能覆盖 `projectRoot`。
- 相对路径基于配置文件所在目录解析。
- 使用 `realpath` 规范化项目根目录。
- 根目录必须包含 `project.json` 和 `assets/`。
- baseline 不存在时允许启动，但必须明确报告未加载。
- 配置错误导致 Server 启动失败，并写 stderr。
- 不从环境变量接受任意项目路径覆盖；如确需测试覆盖，只允许专用测试变量并记录。

## 8. Server 生命周期

### 8.1 启动

1. 加载并验证配置。
2. 解析和固定项目根目录。
3. 初始化 logger 到 stderr。
4. 创建 ProjectContext。
5. 注册 Tools 和 Resources。
6. 建立 stdio transport。
7. 等待 MCP initialize。

### 8.2 能力声明

G3 仅声明：

- `tools`
- `resources`

不声明：

- prompts
- sampling
- elicitation
- tasks
- subscriptions

Tools/Resources 列表固定时，不声明 `listChanged`。如果后续 Runtime 工具动态启用，必须通过 ADR 决定是否使用 list changed notification。

### 8.3 关闭

- stdin 关闭后终止 Server。
- 清理缓存和临时句柄。
- 不残留子进程。
- 不写持久状态。
- G3 不应启动任何长期后台进程。

## 9. ProjectContext

ProjectContext 是 Tools 和 Resources 的唯一项目访问入口。

```ts
export interface ProjectContext {
  readonly projectRoot: string;
  getIndex(options?: { refresh?: boolean }): Promise<ProjectIndex>;
  runChecks(options: {
    ruleIds?: string[];
    includeBaselined?: boolean;
  }): Promise<CheckResult>;
  resolveProjectPath(relativePath: string): string;
}
```

要求：

- `projectRoot` 初始化后不可变。
- `resolveProjectPath` 拒绝绝对路径。
- 拒绝 `..` 逃逸。
- 解析 symlink 后仍必须位于根目录内。
- 缓存必须基于文件 mtime 或显式 refresh 失效。
- 缓存错误不能返回旧数据冒充当前结果。
- 每个 Tool 调用使用一致项目快照。

## 10. 通用输出模型

所有 Tool 输出包含：

```ts
interface ToolEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    serverVersion: string;
    projectVersion?: string;
    generatedAt: string;
    truncated: boolean;
  };
}
```

规则：

- `outputSchema` 描述完整 envelope。
- `structuredContent` 必须符合 schema。
- TextContent 返回同一对象的格式化 JSON，不返回不同语义摘要。
- `generatedAt` 不进入稳定快照的语义比较。
- 超出上限时设置 `truncated: true` 并返回实际数量。
- 错误不得包含工作区外绝对路径内容。

## 11. Tool：`validate_project`

### 11.1 用途

运行 `linkup-check` 的全部或指定规则。

### 11.2 输入

```ts
interface ValidateProjectInput {
  rules?: string[];
  includeBaselined?: boolean;
  maxDiagnostics?: number;
}
```

约束：

- `rules` 只能包含检查器已注册 rule ID。
- 未知规则作为无效参数，不静默忽略。
- `maxDiagnostics` 范围 `1..500`，默认由配置决定。

### 11.3 输出

```ts
interface ValidateProjectData {
  diagnostics: Diagnostic[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    baselined: number;
    passedRules: number;
    returnedDiagnostics: number;
    totalDiagnostics: number;
  };
  executedRules: string[];
}
```

### 11.4 行为

- 不调用 CLI 子进程。
- 直接调用 `runChecks` 库接口。
- 排序与 CLI JSON 输出一致。
- `includeBaselined=false` 时不返回已基线化诊断，但 summary 保留数量。
- 检查发现业务错误时 `ok=true`；这是成功执行后的诊断，不是 Tool 执行失败。
- 配置、解析器崩溃或内部异常时 `ok=false`、`isError=true`。

## 12. Tool：`inspect_ui_prefab`

### 12.1 用途

以受控结构返回一个 GUI prefab 的节点树和组件摘要。

### 12.2 输入

```ts
interface InspectUiPrefabInput {
  uiName: string;
  maxDepth?: number;
  includeInactive?: boolean;
}
```

约束：

- `uiName` 必须匹配项目索引中的逻辑 UI 名称。
- 不接受文件路径。
- `maxDepth` 范围 `0..8`。
- 默认包含 inactive 节点，因为它们可能是状态模板。

### 12.3 输出

```ts
interface UiNodeSummary {
  name: string;
  path: string;
  active: boolean;
  components: string[];
  size?: { width: number; height: number };
  position?: { x: number; y: number };
  children?: UiNodeSummary[];
}

interface InspectUiPrefabData {
  uiName: string;
  prefabPath: string;
  rootNodeName: string;
  controllerPath?: string;
  registrationStatus: "global" | "local" | "unregistered" | "ambiguous";
  tree: UiNodeSummary;
  nodeCount: number;
  returnedNodeCount: number;
  diagnostics: Diagnostic[];
}
```

### 12.4 截断

- 同时执行深度和节点数限制。
- 子树被截断时在节点上增加 `childrenTruncated: true`，如输出 schema采用该字段。
- 不返回 prefab 原始 JSON。
- 不返回 UUID 以外的内部序列化对象，除非有明确用途。

## 13. Tool：`resolve_ui_contract`

### 13.1 用途

返回一个 UI 的文件名、根节点、常量、控制器和节点路径契约。

### 13.2 输入

```ts
interface ResolveUiContractInput {
  uiName: string;
}
```

### 13.3 输出

```ts
interface ResolveUiContractData {
  uiName: string;
  prefab?: {
    path: string;
    rootNodeName: string;
  };
  constant?: {
    file: string;
    key: string;
    value: string;
    line?: number;
  };
  controller?: {
    path: string;
    className: string;
  };
  registration?: {
    file: string;
    method?: string;
    controllerClass?: string;
    line?: number;
  };
  referencedNodePaths: Array<{
    path: string;
    sourceFile: string;
    line?: number;
    kind: "lookup" | "button" | "delay-button" | "mouse";
    exists: boolean | null;
  }>;
  status: "complete" | "incomplete" | "ambiguous" | "not-found";
  diagnostics: Diagnostic[];
}
```

### 13.4 行为

- 数据来自 ProjectIndex 和检查器，不重新实现 TypeScript 解析。
- 动态路径无法求值时 `exists=null`，不能标为 false。
- 不存在 UI 时返回业务错误 `UI_NOT_FOUND`。
- 多个同名 prefab 或控制器时返回 `ambiguous` 和诊断。

## 14. Resources

### 14.1 `linkup://project/profile`

MIME：`application/json`。

内容：

- 项目名。
- Cocos 版本。
- TypeScript target。
- orientation。
- 设计分辨率。
- GUI、UICtrl、Manager 关键目录。
- 当前能力：static-only / runtime-unavailable。

### 14.2 `linkup://project/architecture`

MIME：`text/markdown`。

内容由 ProjectIndex 和 Server 内固定模板确定性生成。不得读取个人 Skill，不得直接返回 1200 行总计划。

### 14.3 `linkup://rules/ui-contracts`

MIME：`text/markdown`。

内容：

- prefab/root/UIName 同名。
- 节点路径契约。
- 动态控制器挂载。
- 模态遮罩、基础尺寸和分组。
- 静态与运行态验证边界。

内容由项目配置、ProjectIndex 和检查器规则元数据生成，不复制 Skill 正文。

### 14.4 `linkup://validation/rules`

MIME：`application/json`。

由检查器规则注册表生成：

```ts
interface ValidationRuleResource {
  rules: Array<{
    id: string;
    title: string;
    description: string;
    defaultSeverity: "error" | "warning" | "info";
  }>;
}
```

### 14.5 Resource 约束

- G3 使用固定资源列表，不需要 resource templates。
- 不支持订阅。
- 不声明 listChanged。
- 不暴露任意 URI 到文件映射。
- Resource read 错误返回标准资源错误。

## 15. 错误模型

### 15.1 协议错误

用于：

- 未知 Tool。
- JSON Schema 无效输入。
- 未知 Resource URI。
- MCP 生命周期错误。

### 15.2 Tool 执行错误

错误码：

| Code | 含义 |
|---|---|
| `CONFIG_INVALID` | Server 配置无效 |
| `PROJECT_NOT_FOUND` | 固定项目根不可用 |
| `PROJECT_INDEX_FAILED` | 项目索引失败 |
| `CHECK_FAILED` | 检查器内部失败 |
| `UI_NOT_FOUND` | UI 名称不存在 |
| `UI_AMBIGUOUS` | UI 映射不唯一 |
| `LIMIT_EXCEEDED` | 请求超出限制 |
| `PATH_BOUNDARY_VIOLATION` | 路径逃逸或非法路径 |
| `RUNTIME_UNAVAILABLE` | G4 未实现或未连接 |
| `INTERNAL_ERROR` | 未分类内部错误 |

要求：

- 面向客户端的 message 简洁稳定。
- stack trace 只写 stderr，测试环境可捕获。
- 不在 message 中泄露工作区外路径。
- 所有未知异常映射为 `INTERNAL_ERROR`。

## 16. 日志与审计

### 16.1 G3 日志

写 stderr：

- Server 启动/关闭。
- 配置加载结果，不记录敏感值。
- Tool 名、耗时、成功/失败。
- Resource URI 和成功/失败。
- 截断事件。

不记录：

- 完整 prefab 内容。
- 完整 Tool 输出。
- 用户隐私、令牌、环境变量。
- stdout 调试文本。

### 16.2 日志格式

推荐单行 JSON 到 stderr：

```json
{
  "level": "info",
  "event": "tool.complete",
  "tool": "validate_project",
  "durationMs": 42,
  "ok": true
}
```

测试必须证明 stdout 无日志污染。

## 17. 安全设计

### 17.1 进程边界

- stdio Server 由 Host 启动。
- 不执行配置中的命令字符串。
- 不创建监听端口。
- 不继承或打印不需要的环境变量。
- 不动态加载工作区代码。

### 17.2 文件边界

- 唯一业务项目根为 `01/LinkUpClient`。
- 固定内部依赖白名单仅包括 Server 自身包和 `01/tools/linkup-check` 包。
- 客户端不能提供或覆盖这些根目录。
- 只读打开已知项目文件和固定内部依赖。
- 所有路径规范化后进行 root containment 检查。
- 测试绝对路径、`..`、symlink、URL 编码和混合分隔符。
- MCP Tool 不接受 path 参数，优先接受 `uiName` 或 rule ID。

### 17.3 能力最小化

- 无 shell。
- 无 eval。
- 无 write。
- 无网络。
- 无 OAuth。
- 无 token passthrough。
- 无通用代理。

### 17.4 依赖供应链

- 仅安装官方 SDK 及其必要依赖。
- 提交 lockfile。
- 审查 install scripts。
- 验收时列出依赖树和许可证摘要。

## 18. 性能设计

目标：

- Server 启动不要求扫描完整项目；首次需要时惰性建索引。
- 同一 Tool 调用内每个 prefab 只解析一次。
- 缓存可通过 mtime 失效。
- `validate_project` 支持规则过滤。
- Tool 输出有数量和深度上限。
- 未连接 Runtime 时 G4 Tool（如果注册）必须在 2 秒内失败；G3 默认不注册 Runtime Tool。

性能测试记录：

- 冷启动时间。
- 首次索引时间。
- 热缓存查询时间。
- 全量验证时间。
- 最大输出大小。

不设脱离开发机事实的硬性毫秒门槛；验收记录基线并防止数量级退化。

## 19. 测试计划

### 19.1 单元测试

- 配置解析。
- root containment。
- Tool 输入 schema。
- Tool 输出 schema。
- diagnostics 映射。
- tree depth/node limit。
- error mapping。
- Resource 内容生成。

### 19.2 集成测试

- 使用最小 LinkUp fixture 项目。
- 调用三个 Tool。
- 读取四个 Resource。
- 与 `linkup-check` 直接调用结果对比。
- 项目缺失、损坏 prefab、重复 UI 名称。

### 19.3 协议测试

- initialize。
- tools/list。
- tools/call。
- resources/list。
- resources/read。
- shutdown/transport close。
- 无效 method/arguments。

### 19.4 安全测试

- 绝对路径。
- `../`。
- symlink 逃逸。
- 非法 uiName。
- 超长 uiName。
- 超大 `maxDiagnostics`。
- stdout 污染检测。
- Tool 列表不存在危险能力。
- 运行前后 LinkUpClient 文件哈希不变。

### 19.5 契约测试

- CLI 与 MCP diagnostics 相同。
- `outputSchema` 与 `structuredContent` 相同。
- TextContent JSON 与 `structuredContent` 语义相同。
- Resource 中规则列表与检查器注册表相同。
- 项目 profile 与实际 `project.json/tsconfig/cp.config` 相同。

## 20. 实施工作包

### MP0：协议与 SDK 决策

交付：

- `01/docs/decisions/ADR-MCP-001-sdk-and-protocol.md`。
- SDK、协议版本、Node 版本和依赖决策。
- 官方规范链接。

验收：没有编码前的未决关键版本。

### MP1：项目骨架

交付：

- package/tsconfig/build/test。
- 空 Server 可 initialize 并优雅关闭。
- stdout/stderr 测试。

验收：只声明空或最小能力，不伪造 Tool。

### MP2：ProjectContext

交付：

- 配置。
- 根目录锁定。
- `linkup-check` 库适配。
- ProjectIndex 适配。
- 路径安全测试。

验收：无通用路径输入，外部路径不可达。

### MP3：`validate_project`

交付：Tool、schemas、tests。

验收：与 CLI JSON 契约一致。

### MP4：UI Tools

交付：

- `inspect_ui_prefab`。
- `resolve_ui_contract`。
- 深度/数量限制。
- not-found/ambiguous 处理。

验收：UISet 正常；不存在、冲突和动态路径正确降级。

### MP5：Resources

交付：四个固定 Resource。

验收：来源可追踪、不暴露原始任意文件。

### MP6：协议与安全硬化

交付：

- 完整错误模型。
- 日志。
- stdout 纯净。
- traversal/symlink/oversize 测试。
- LinkUpClient 零写入证明。

### MP7：客户端验证

交付：

- MCP Inspector 或等价客户端执行记录。
- tools/list、三次 tools/call、resources/list/read 证据。
- 启停和错误场景证据。

### MP8：G3 提交包

交付：

- 文件清单。
- 依赖清单。
- 命令与输出摘要。
- 测试报告。
- 偏差说明。
- 验收命令。

实施 AI不得自行标记 G3 PASS。

## 21. 实施 AI 允许与禁止范围

### 允许

- `01/mcp/linkup-dev-mcp/**`
- `01/docs/decisions/ADR-MCP-*.md`
- `01/docs/acceptance/` 下的实施证据草稿
- 为公开库接口兼容对 `01/tools/linkup-check/**` 做最小修改

### 禁止

- `01/LinkUpClient/**`
- `01/skill/**`
- `01/agent/**`
- 个人 Skill 目录
- 工作区外文件
- Runtime 依赖和代码

### Tools 兼容修改要求

如需修改 `linkup-check`：

- 先说明缺失接口。
- 不改变现有 CLI 语义。
- Tools 全部测试必须继续通过。
- 修改必须与 MCP 适配直接相关。

## 22. G3 独立验收

### 22.1 必跑命令

实际命令以 package scripts 为准，至少包含：

```bash
npm ci
npm run typecheck
npm run build
npm test
```

`npm ci` 需要网络或缓存时，由验收环境按权限执行。

### 22.2 协议验收

- initialize 成功。
- Server 信息含 name/version。
- tools/list 恰好包含批准 Tools。
- resources/list 恰好包含批准 Resources。
- 每个 Tool 正常、无效输入、业务失败各测一次。
- 每个 Resource 可读。
- stdout 无非协议输出。

### 22.3 安全验收

- 无通用路径、文件、shell、eval、网络 Tool。
- 路径逃逸测试全部通过。
- 调用前后 `01/LinkUpClient` 哈希一致。
- 进程退出后无残留服务。
- 依赖与 lockfile 一致。

### 22.4 结果判定

以下任一情况直接 FAIL：

- MCP 复制而不是复用检查器规则。
- CLI 与 MCP 同一检查结果不一致。
- outputSchema 与 structuredContent 不一致。
- stdout 出现日志。
- Tool 可接受任意项目根或文件路径。
- 运行后 LinkUpClient 被修改。
- 危险 Tool 存在，即使未在文档公开。

## 23. G4 Runtime 技术验证计划

G4 先做 Spike，不直接实现完整能力。

### 23.1 Spike 问题

- 能否在不修改业务代码下连接 Cocos 2.4.15 预览？
- 能否读取 `cc.director.getScene()`？
- 能否稳定序列化节点树？
- 能否获取控制台日志？
- 能否捕获预览截图？
- 需要何种浏览器、端口或注入权限？

### 23.2 候选方案

#### A：浏览器预览 + CDP/自动化

优点：不修改游戏代码。  
风险：需要控制预览浏览器、依赖较重、Cocos 启动方式不确定。

#### B：开发态 Runtime Bridge

优点：Cocos API 访问直接、协议可控。  
风险：需要修改项目、必须确保正式构建关闭。

#### C：其他外部适配

必须证明不依赖已删除 Inspector，也不引入更大权限面。

### 23.3 Spike 交付

- 可运行最小原型或明确失败证据。
- ADR 对比表。
- 推荐方案和否决方案。
- LinkUpClient 修改需求。
- 安全与发布隔离方案。
- G4 详细估算和验收命令。

Spike 未批准前不得进入 Runtime 实现。

## 24. 完成定义

### G3 完成

1. MP0–MP8 全部完成。
2. 三个 Tools 和四个 Resources 符合契约。
3. CLI/MCP 契约测试一致。
4. 所有安全测试通过。
5. LinkUpClient 零写入。
6. 独立验收状态为 PASS。

### G4 完成

1. 真实需求和 ADR 已批准。
2. Runtime 能力默认只读。
3. 连接、节点、日志、截图通过测试。
4. 无 eval、无 prefab 回写。
5. 正式构建不暴露 Bridge。
6. 独立验收状态为 PASS。

## 25. 计划批准检查表

- [ ] 同意 G3 只实现项目分析 MCP，不实现 Runtime。
- [ ] 同意第一版只支持 stdio。
- [ ] 同意三个 Tools、四个 Resources 的接口范围。
- [ ] 同意不提供通用文件、shell、eval 和网络能力。
- [ ] 同意 MCP 复用 `linkup-check`，不复制规则。
- [ ] 同意 G4 必须先做 Spike 和 ADR。
- [ ] 同意实施 AI 不负责最终验收。

未批准前，状态保持“详细计划完成，MCP 未实施”。

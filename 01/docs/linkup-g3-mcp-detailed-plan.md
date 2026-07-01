# LinkUpClient G3 只读 MCP 详细实施与独立验收计划

> 文档状态：仅实施计划，尚未实施  
> 日期：2026-07-01  
> 阶段：G3  
> 前置阶段：G1 `PASS WITH NOTES`，G2 `PASS WITH NOTES`  
> 实施者：实施 AI  
> 最终判定：独立验收 AI  
> 目标目录：`01/mcp/linkup-dev-mcp/`

## 1. 阶段目标

G3 实现一个本地、只读、最小权限的 `linkup-dev-mcp` stdio MCP Server，把 G1 已验证的静态检查能力和 LinkUpClient UI 契约转换为标准 MCP Tools 与 Resources。

目标闭环：

```text
支持 MCP 的 Agent Host
→ stdio MCP Client
→ linkup-dev-mcp
→ linkup-check 公共库接口 / 只读项目索引
→ structuredContent
→ Agent Host
```

G3 证明的是“不同 Host 可以通过标准协议获得一致的项目事实”，不是 Runtime Inspector，不产生游戏界面，也不修改游戏。

## 2. 权威来源与冲突处理

发生冲突时按以下优先级处理：

1. `01/LinkUpClient/**` 当前实际文件。
2. `01/tools/linkup-check/**` 当前公共接口、测试和真实输出。
3. 实施时核对的 MCP 官方规范和官方 TypeScript SDK 文档。
4. 本计划。
5. `01/docs/linkup-ai-engineering-master-plan.md`。
6. `01/docs/linkup-mcp-implementation-plan.md` 的通用设计。
7. G2 仓库 Skill references。

本计划是当前 G3 的可执行阶段计划。若与旧 `linkup-mcp-implementation-plan.md` 的 G3 内容冲突，以本计划为准。G4 Runtime 内容不属于本阶段。

## 3. 当前已确认事实

- Node.js 当前环境：`v22.22.2`。
- LinkUpClient：Cocos Creator `2.4.15`。
- `packages` 目录已删除，不能依赖、读取或重建。
- G1 包：`01/tools/linkup-check`，ESM，Node `>=18`。
- G1 当前公共导出：`runChecks`、`listRules` 和 reporter/diagnostic helpers。
- G1 内部已有且通过测试的只读能力：
  - `buildProjectIndex`
  - `parsePrefab`
  - `getRootNodeName`
  - `walkNodes`
  - `getComponents`
  - `nodeHasComponent`
  - `extractNodePaths`
- 真实项目 G1 基准：`0 errors / 0 warnings / 14 infos / 14 baselined / 5 passedRules`。
- G2 仓库 Skill 位于 `01/skill/linkup-client`，G3 不安装或修改它。
- `01/mcp/` 当前无 G3 实现。

## 4. G3 范围

### 4.1 必须实现

- 一个本地 stdio MCP Server。
- 正常 initialize、能力协商和关闭。
- 恰好三个只读 Tools：
  - `validate_project`
  - `inspect_ui_prefab`
  - `resolve_ui_contract`
- 恰好四个只读 Resources：
  - `linkup://project/profile`
  - `linkup://project/architecture`
  - `linkup://rules/ui-contracts`
  - `linkup://validation/rules`
- 输入 schema、输出 schema 和结构化错误。
- `structuredContent` 与兼容 TextContent。
- 固定项目根、路径边界和 symlink 逃逸保护。
- G1 公共 API 的最小兼容扩展。
- 单元、集成、协议、契约和安全测试。
- 官方 SDK Client 或 MCP Inspector 的真实协议记录。
- CLI 与 MCP 诊断一致性证据。

### 4.2 明确不实现

- Cocos Runtime Bridge、节点树、控制台、截图或预览控制。
- Streamable HTTP、SSE、监听端口或远程部署。
- Prompts、Sampling、Elicitation、Tasks、Subscriptions。
- OAuth、令牌、用户系统。
- 通用 `read_file`、`write_file`、目录浏览。
- shell、子进程执行 Tool、eval 或动态代码加载。
- URL/网络请求 Tool。
- 自动修复或任何业务文件写入。
- 自定义 Agent Host 或 Agent Evals。
- 修改、安装或激活 G2 Skill。

## 5. 写入范围

### 5.1 允许写入

- `01/mcp/linkup-dev-mcp/**`
- `01/docs/decisions/ADR-MCP-001-sdk-and-protocol.md`
- `01/docs/acceptance/G3-implementation-report-YYYYMMDD.md`

### 5.2 预批准的 G1 最小兼容写入

仅允许：

- `01/tools/linkup-check/src/index.mjs`
- `01/tools/linkup-check/test/public-api.test.mjs`

允许行为只有：

1. 从现有模块 re-export 第 3 节列出的只读解析/索引函数。
2. 为公共导出增加 API 测试。

禁止借此修改规则、诊断、baseline、CLI、排序、解析逻辑或既有测试预期。如果需要其他 G1 文件，实施 AI 必须停止并提交计划偏差请求。

### 5.3 禁止写入

- `01/LinkUpClient/**`
- `01/skill/**`
- `01/agent/**`
- `01/tools/linkup-check/linkup-check.baseline.json`
- G1/G2 验收记录
- 本计划、总计划和旧 MCP 计划
- `~/.codex/**` 或任何个人 Skill/MCP 配置
- 工作区外目录，临时测试目录除外

### 5.4 禁止动作

- 不 commit、push 或创建 PR，除非用户另行授权。
- 不注册到用户的全局 MCP 配置。
- 不启动长期后台服务。
- 不用 mock transcript 冒充真实 MCP 调用。
- 不使用 subagent，除非用户明确授权。

## 6. 协议与 SDK 基线

计划编写日核对结果：

- 当前稳定协议修订：`2025-11-25`。
- stdio 要求：每行一个 UTF-8 JSON-RPC 消息；stdout 不得出现非 MCP 内容；日志可写 stderr。
- 官方 TypeScript SDK v2 仍为 alpha，官方建议生产使用 v1.x。
- 当前稳定 v1 包：`@modelcontextprotocol/sdk@1.29.0`。

G3 基线：

- 使用 `@modelcontextprotocol/sdk@1.29.0`，精确锁定，不使用 `^`、`~` 或 `latest`。
- 不使用 `@modelcontextprotocol/server@2.*-alpha`。
- 使用官方 v1 `McpServer`、`StdioServerTransport` 和官方 Client 测试接口。
- 仅支持 stdio。
- 协议版本由 initialize 协商，不手工伪造。

实施 AI 编码前必须执行并记录：

```bash
npm view @modelcontextprotocol/sdk version dist-tags --json
npm view @modelcontextprotocol/sdk@1.29.0 engines peerDependencies dependencies --json
node --version
npm --version
```

若 `1.29.0` 已撤回、存在官方安全通告或无法安装，停止并提交偏差请求；不得自行切换 v2 alpha。

ADR 必须记录：协议修订、SDK 精确版本、Node 版本、schema 库版本、选择 v1 的原因和 v2 alpha 排除理由。

官方参考：

- <https://modelcontextprotocol.io/specification/2025-11-25/basic/transports>
- <https://modelcontextprotocol.io/specification/2025-11-25/server>
- <https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x>
- <https://www.npmjs.com/package/@modelcontextprotocol/sdk>

## 7. 依赖规则

允许直接依赖：

- `@modelcontextprotocol/sdk`，精确版本 `1.29.0`。
- SDK v1 官方兼容的 `zod` 精确版本；实际版本写入 ADR。
- `linkup-check`，使用本地 `file:../../tools/linkup-check`。
- `typescript` 和 `@types/node` 作为精确锁定的开发依赖。

规则：

- 必须提交 `package-lock.json`。
- `npm ci` 必须可从 lockfile 重建。
- 不引入 Web 框架、glob、logger、CLI framework 或 test runner。
- 测试优先使用 `node:test`。
- Server 运行时代码不得依赖 `child_process`、`http`、`https`、`net` 或浏览器自动化。
- 协议集成测试可以由官方 SDK Client 启动 Server 子进程。
- 安装依赖需要网络权限时按环境流程请求，不绕过权限。

## 8. 交付目录

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
│   └── resources/
│       ├── project-profile.ts
│       ├── project-architecture.ts
│       ├── ui-contracts.ts
│       └── validation-rules.ts
└── test/
    ├── fixtures/minimal-linkup/
    ├── unit/
    ├── integration/
    ├── protocol/
    ├── contract/
    └── security/
```

不得创建 `runtime/` 空目录、README、HTTP 入口或未在本计划批准的示例应用。

## 9. 配置契约

`linkup-mcp.config.json`：

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

要求：

- 相对路径基于配置文件目录解析，不基于调用者 cwd。
- 启动时使用 `realpath` 固定项目根和 baseline。
- 项目根必须含 `project.json`、`assets/Scripts`、`assets/BundleLLK/GUI`。
- Tool 参数不能覆盖 projectRoot、baselinePath 或配置文件路径。
- 生产入口不接受环境变量覆盖业务根。
- 测试通过依赖注入直接创建 ProjectContext，不修改生产配置。
- 配置错误在连接前失败，错误写 stderr，stdout 保持纯净。

## 10. G1 公共 API 适配契约

MCP 必须通过 `linkup-check` 包根导入，不得深层导入其 `src/*` 文件。

`src/index.mjs` 只增加现有函数 re-export，目标公共接口：

```js
export { buildProjectIndex } from "./project-index.mjs";
export {
  parsePrefab,
  getRootNodeName,
  walkNodes,
  getComponents,
  nodeHasComponent
} from "./prefab-parser.mjs";
export { extractNodePaths } from "./ts-extractor.mjs";
```

公共 API 测试必须证明：

- 所有导出可从包根加载。
- `runChecks` 与原 CLI 结果不变。
- `buildProjectIndex` 可索引最小 fixture 和真实 `UISet`。
- re-export 没有产生写入。

MCP 只能组合这些已有结果；不得复制正则、Prefab 解析或诊断规则。

## 11. Server 生命周期

启动顺序：

1. 加载并验证固定配置。
2. 固定 realpath 项目根。
3. 创建只写 stderr 的 logger。
4. 创建 ProjectContext。
5. 注册三个 Tools 和四个 Resources。
6. 连接 StdioServerTransport。
7. 等待 initialize。

能力声明只包含：

- `tools`
- `resources`

不得声明 prompts、logging capability、sampling、elicitation、tasks、subscriptions 或 listChanged。

关闭要求：

- stdin 关闭或 Client close 后 Server 正常退出。
- 无定时器、watcher、端口或孤儿进程。
- 不保存状态、不写缓存文件。

## 12. ProjectContext 契约

ProjectContext 是所有 Tool/Resource 的唯一项目访问入口：

```ts
interface ProjectContext {
  readonly projectRoot: string;
  readonly baselinePath: string;
  runChecks(input: { ruleIds?: string[] }): Promise<CheckResult>;
  getIndex(): ProjectIndex;
  resolveKnownProjectFile(relativePath: string): string;
}
```

约束：

- projectRoot 初始化后不可变。
- `resolveKnownProjectFile` 只用于 Server 内部固定白名单文件。
- 拒绝绝对路径、`..`、NUL、URL 编码逃逸和混合分隔符逃逸。
- 对存在文件执行 realpath 后再次检查 root containment。
- symlink 指向根外必须拒绝。
- 不把绝对路径返回客户端。
- 一次 Tool 调用只能使用同一份 index 快照。
- G3 可以每次调用重建索引；若加入缓存，必须有明确失效测试，不能返回过期结果。

## 13. 通用 Tool 输出

```ts
interface ToolEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    serverVersion: string;
    generatedAt: string;
    truncated: boolean;
  };
}
```

规则：

- 每个 Tool 注册 `inputSchema` 和 `outputSchema`。
- `structuredContent` 必须通过输出 schema 校验。
- TextContent 是同一 envelope 的 JSON 序列化，不允许语义不同。
- `generatedAt` 不参与稳定快照比较。
- 用户输入错误由 SDK/schema 层拒绝。
- UI 不存在等领域错误返回 `ok=false`、稳定错误码和 `isError=true`。
- 检查器发现业务诊断仍是成功执行：`ok=true`。
- stack trace 只写 stderr，不返回客户端。

## 14. Tool：`validate_project`

输入：

```ts
interface ValidateProjectInput {
  rules?: string[];
  includeBaselined?: boolean;
  maxDiagnostics?: number;
}
```

约束：

- `rules` 只能来自 `listRules()`。
- `maxDiagnostics` 范围 `1..500`。
- 不接受 project、path、baseline、cwd 等参数。

输出 data：

```ts
interface ValidateProjectData {
  diagnostics: Diagnostic[];
  summary: CheckResult["summary"] & {
    returnedDiagnostics: number;
    totalDiagnostics: number;
  };
  executedRules: string[];
}
```

行为：

- 直接调用 `runChecks`，不得启动 CLI 子进程。
- 默认使用真实 baseline。
- `includeBaselined=false` 只过滤返回数组，不篡改原 summary。
- 截断发生时保留 total，设置 `meta.truncated=true`。
- 未截断、包含 baseline 的结果必须与直接 `runChecks` 深度一致。

## 15. Tool：`inspect_ui_prefab`

输入：

```ts
interface InspectUiPrefabInput {
  uiName: string;
  maxDepth?: number;
  includeInactive?: boolean;
}
```

约束：

- `uiName` 匹配 `^[A-Za-z][A-Za-z0-9_]{0,127}$`。
- 不接受路径或 URI。
- `maxDepth` 范围 `0..8`。
- 默认包含 inactive 节点。

输出至少包含：

- uiName。
- prefab 相对路径。
- rootNodeName。
- controller 相对路径（如存在）。
- registrationStatus：`global | local | unregistered | ambiguous`。
- 限深节点树：name、相对 node path、active、component type、position、size。
- nodeCount、returnedNodeCount 和截断标记。
- 与该 UI 相关的 G1 diagnostics。

要求：

- 使用 `walkNodes` 和 `getComponents`。
- component 从节点 `_components` 引用映射，不返回原始序列化对象。
- 不返回 prefab 原始 JSON、UUID、绝对路径或 controller 完整源码。
- 同名冲突返回 `UI_AMBIGUOUS`。

## 16. Tool：`resolve_ui_contract`

输入：

```ts
interface ResolveUiContractInput {
  uiName: string;
}
```

输出至少包含：

- prefab basename、相对路径、rootNodeName。
- UIName key/value/line（能确定时）。
- UIControllerName key/value。
- controller 相对路径和类名。
- UIController handler、controller class 和行号（能确定时）。
- `extractNodePaths` 得到的 literal/dynamic node paths。
- path kind：lookup、button、delay-button、mouse。
- 静态路径 exists：`true | false`；动态路径为 `null`。
- status：`complete | incomplete | ambiguous | not_found`。
- 相关 G1 diagnostics。

要求：

- 不重新实现 TypeScript 提取正则。
- `UISet` 必须解析为已注册全局 UI。
- 不存在 UI 返回 `UI_NOT_FOUND`、`ok=false`、`isError=true`。
- local-only UI 不得被虚报为全局注册。

## 17. Resources

### 17.1 `linkup://project/profile`

- MIME：`application/json`。
- 返回项目名、Cocos 版本、TypeScript target/module、设计分辨率、关键相对目录。
- 明确：`capabilityMode="static-only"`、`runtimeAvailable=false`。

### 17.2 `linkup://project/architecture`

- MIME：`text/markdown`。
- 确定性说明入口、UIRoot、UIManager、UIController、UIComponent、Manager 和 bundle 关系。
- 内容应是面向 MCP 的简洁事实资源，不整段复制 G2 Skill 或总计划。

### 17.3 `linkup://rules/ui-contracts`

- MIME：`text/markdown`。
- 包含 prefab/root/UIName、动态 addComponent、node path、button、global/local registration、静态/运行态边界。
- 明确 `packages` 不存在且不可依赖。

### 17.4 `linkup://validation/rules`

- MIME：`application/json`。
- rule ID 必须实时来自 `listRules()`。
- 可附 MCP 展示描述和可能 severity，但不得把 mixed-severity 规则错误标为单一 ERROR。
- 包含 baseline 路径的仓库相对表示和退出语义；不返回绝对路径。

### 17.5 Resource 约束

- 恰好四个固定 URI。
- 不使用 Resource Templates。
- 不支持订阅或 listChanged。
- 不把任意 URI 映射为文件路径。
- 每项内容必须有 fixture/真实项目测试。

## 18. 错误码

| Code | 含义 |
|---|---|
| `CONFIG_INVALID` | 固定配置无效 |
| `PROJECT_NOT_FOUND` | 固定项目根不可用 |
| `PROJECT_INDEX_FAILED` | 项目索引失败 |
| `CHECK_FAILED` | G1 检查执行失败 |
| `UI_NOT_FOUND` | uiName 不存在 |
| `UI_AMBIGUOUS` | UI 映射不唯一 |
| `LIMIT_EXCEEDED` | 请求超过限制 |
| `PATH_BOUNDARY_VIOLATION` | 内部路径越界 |
| `INTERNAL_ERROR` | 未分类内部错误 |

G3 不注册 Runtime Tool，因此不要返回 `RUNTIME_UNAVAILABLE` Tool 结果；Host 查询工具列表时应直接看不到 Runtime 能力。

## 19. 日志与 stdout

- stdout 只能由 StdioServerTransport 写 MCP JSON-RPC。
- 所有日志写 stderr。
- 日志可记录启动、关闭、tool/resource 名称、耗时和成功状态。
- 不记录完整输入、完整输出、prefab、controller 源码、环境变量或绝对路径。
- 测试必须捕获原始 stdout，逐行验证均为合法 JSON-RPC；任何 banner、console.log 或调试文本直接 FAIL。

## 20. 安全门禁

必须测试：

- Tool schema 不存在 path、projectRoot、baselinePath、command、code、url 字段。
- uiName 拒绝 `../`、绝对路径、URL 编码、NUL、超长字符串和混合分隔符。
- 内部 root containment 拒绝 symlink 指向根外。
- tools/list 恰好三个批准 Tool。
- resources/list 恰好四个批准 Resource。
- Server 运行时代码无 shell/eval/网络/写文件能力。
- 调用前后 LinkUpClient tracked 文件 hash 和 git status 一致。
- Server 不监听端口。
- Client 关闭后 Server 在测试超时内退出。

测试 fixture 可以在临时目录创建 symlink 和损坏文件；不得在真实 LinkUpClient 制造安全场景。

## 21. 测试矩阵

### 21.1 G1 回归

- G1 全部测试通过，测试数不得减少。
- 真实 CLI 结果保持当前基准。
- 新公共 API 测试通过。

### 21.2 MCP 单元测试

- config 和 realpath。
- containment 与 symlink。
- input/output schema。
- Tool envelope 和 error mapping。
- tree depth/node limit。
- node component 映射。
- UI contract 状态推导。
- 四项 Resource 内容。

### 21.3 MCP 集成测试

使用 `test/fixtures/minimal-linkup`：

- 一个完整 global UI。
- 一个 local-only UI。
- 一个损坏 node path。
- 一个 ambiguous/duplicate UI fixture，可按测试动态生成。
- 空 baseline。

验证三个 Tool 和四个 Resource，不读取真实业务项目作为单元 fixture。

### 21.4 协议测试

使用官方 SDK Client 与 StdioClientTransport 启动构建后的真实 Server：

- initialize。
- tools/list。
- 三个 tools/call。
- resources/list。
- 四个 resources/read。
- 无效 tool input。
- UI_NOT_FOUND。
- client close / server exit。
- stdout 纯净。

### 21.5 真实项目契约测试

- 直接 `runChecks` 与 MCP `validate_project` 语义深比较。
- `inspect_ui_prefab({uiName:"UISet",maxDepth:4})` 返回 UISet 根和有限节点树。
- `resolve_ui_contract({uiName:"UISet"})` 返回 prefab、constant、controller 和 global registration。
- 不存在 UI 返回稳定 not_found。
- 四个 Resource 与实际项目关键事实一致。

### 21.6 只读证明

实施前后记录：

```bash
git status --short -- 01/LinkUpClient
git ls-files -z 01/LinkUpClient | xargs -0 shasum -a 256
```

报告中保存聚合方式或 manifest 对比结果。不得把生成目录变化当作可忽略；G3 不应启动 Cocos。

## 22. package scripts 门禁

至少提供：

```json
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsc -p tsconfig.json",
    "test": "node --test <compiled-test-pattern>",
    "start": "node dist/src/index.js"
  }
}
```

实施 AI可调整 compiled test pattern，但必须保证以下命令真实通过：

```bash
npm ci
npm run typecheck
npm run build
npm test
```

不得让 `test` 隐式跳过 build 却依赖旧 dist。报告需给出从干净安装到测试的完整顺序。

## 23. 实施工作包

### G3-P0：范围锁定与快照

- 读取本计划、总计划和实际 G1/G2 文件。
- 记录 git status、Node/npm、G1 测试、真实检查结果和 LinkUpClient hash。
- 确认目标目录没有用户文件。

退出：前置条件全部成立，否则停止。

### G3-P1：SDK/协议 ADR

- 核对官方版本。
- 写 ADR-MCP-001。
- 锁定 v1 SDK 和依赖。

退出：版本、协议和排除项无未决问题。

### G3-P2：G1 公共 API 桥

- 只增加 re-export。
- 新增 public-api 测试。
- 跑全部 G1 回归和真实 CLI。

退出：既有行为不变，MCP 不需要深层 import。

### G3-P3：MCP 骨架与协议 smoke test

- 创建 package/tsconfig/config。
- 实现空的 Server 构建入口。
- 使用官方 Client 完成 initialize/close。
- 证明 stdout 无日志。

退出：生命周期稳定，无长期进程。

### G3-P4：ProjectContext 与安全边界

- 固定配置和项目根。
- 封装 G1 公共 API。
- 实现 containment/symlink/错误映射。

退出：根外文件不可达。

### G3-P5：`validate_project`

- 完成 schema、handler、截断和契约测试。
- 对比直接 G1 与 MCP 结果。

退出：真实项目结果一致。

### G3-P6：两个 UI Tools

- 实现 prefab tree/component summary。
- 实现 UI contract resolution。
- 完成 UISet、local、not-found、ambiguous、dynamic path 测试。

退出：不返回原始文件或绝对路径。

### G3-P7：四个 Resources

- 注册固定 URI。
- 生成确定性内容。
- 完成 list/read/unknown URI 测试。

退出：来源可追踪，规则 ID 与 G1 一致。

### G3-P8：全量硬化与提交包

- 运行 typecheck/build/test、G1 回归、真实项目契约和安全测试。
- 保存官方 SDK Client 或 Inspector transcript。
- 对比 LinkUpClient 状态/hash。
- 确认无 Runtime/Agent/Skill 写入。
- 写 G3 实施报告。

退出：提交包可由独立验收 AI复现。

## 24. 实施报告要求

`01/docs/acceptance/G3-implementation-report-YYYYMMDD.md` 必须包含：

1. 实际 changed-file list。
2. 计划偏差；无偏差写“无”。
3. ADR 摘要、协议和所有精确依赖版本。
4. npm 安装、typecheck、build、test 的命令、原始摘要和 exit code。
5. G1 回归和真实项目结果。
6. tools/list 和 resources/list 的完整名称/URI。
7. 三个 Tool 的真实正常调用证据。
8. 四个 Resource 的真实读取证据。
9. UI_NOT_FOUND、schema 错误和路径攻击证据。
10. CLI/MCP 对比方法与结果。
11. stdout/stderr 分离证据。
12. Server 正常退出和无孤儿进程证据。
13. LinkUpClient 前后 status/hash 对比。
14. 未执行 Runtime/Cocos/视觉验证声明。
15. 独立验收者可复制的命令。
16. 实施 AI不自我宣布 G3 通过。

## 25. 独立验收矩阵

| ID | 验收项 | 独立方法 | 通过标准 |
|---|---|---|---|
| G3-01 | 范围 | 检查实际 diff/status | 仅允许路径有实施改动 |
| G3-02 | 依赖 | 检查 ADR/package/lock | v1 精确锁定，无 alpha/Web 框架 |
| G3-03 | G1 API | 从包根导入并跑回归 | re-export 可用，既有 71 测试不减少 |
| G3-04 | initialize | 官方 SDK Client 连接 | 握手成功，name/version 正确 |
| G3-05 | 能力最小化 | tools/list/resources/list | 恰好 3 Tools、4 Resources，无 Runtime |
| G3-06 | stdout | 捕获原始流 | stdout 只有合法 MCP 消息 |
| G3-07 | validate_project | 与直接 runChecks 比较 | 诊断和 summary 语义一致 |
| G3-08 | inspect_ui_prefab | 查询 UISet | 限深树、组件、相对路径正确 |
| G3-09 | resolve_ui_contract | 查询 UISet | constant/prefab/controller/registration/path 完整 |
| G3-10 | not-found | 查询不存在 UI | `UI_NOT_FOUND` 结构化错误 |
| G3-11 | Resources | 逐项读取 | 四项可读，内容来自当前事实 |
| G3-12 | 输入边界 | 提交恶意 uiName/超限值 | schema 拒绝，不泄露文件 |
| G3-13 | symlink 边界 | 临时 fixture 逃逸 | root 外目标不可读 |
| G3-14 | 无危险能力 | 审查 schema/source/list | 无 file/shell/eval/network/write Tool |
| G3-15 | 只读 | 前后 status/hash | LinkUpClient 完全不变 |
| G3-16 | 退出 | 关闭 Client 并查进程 | Server 正常退出，无孤儿进程 |
| G3-17 | 全量质量 | npm ci/typecheck/build/test | 全部 exit 0 |
| G3-18 | 提交包 | 检查报告并复跑 | 证据真实、完整、可复制 |

最终结论只能是：`PASS`、`PASS WITH NOTES`、`FAIL` 或 `BLOCKED`。

## 26. 自动 FAIL 条件

以下任一项直接 `FAIL`：

- 修改 `01/LinkUpClient`、G2 Skill、Agent 或个人配置。
- 使用 v2 alpha 或未锁定依赖且无批准偏差。
- MCP 复制 G1 规则/正则/Prefab 解析器。
- MCP 深层导入 `linkup-check/src/*`。
- CLI 与 MCP 同一输入结果不一致。
- stdout 出现非协议文本。
- Tool 接受任意 path、projectRoot、command、code 或 URL。
- 存在 read/write/shell/eval/network/Runtime Tool。
- 可通过 symlink 或输入读取项目根外文件。
- outputSchema 与 structuredContent 不一致。
- tools/list 或 resources/list 超出批准集合。
- 用 mock 输出冒充真实 MCP transcript。
- 临时场景写入真实 LinkUpClient。
- Server 关闭后残留进程。
- 实施 AI自行宣布验收通过。

`BLOCKED` 只用于外部条件导致必需协议验证无法执行且无安全替代方案；依赖难装、测试难写或实现耗时不是 BLOCKED。

## 27. 非阻断备注范围

仅在所有硬门禁通过后，以下内容可作为 `PASS WITH NOTES`：

- 文案可进一步精简。
- 性能仅记录基准，未设置毫秒硬门槛。
- 使用官方 SDK Client 作为 Inspector 等价客户端。
- Runtime、视觉和 Cocos Editor 验证未执行且报告准确。
- MCP 尚未写入用户全局 Host 配置。

## 28. G3 完成边界

G3 完成表示：

- 本地 stdio MCP Server 可被标准 Client 调用。
- 三个 Tools、四个 Resources 正确且只读。
- G1 CLI 与 MCP 结果一致。
- LinkUpClient 不变。
- 独立验收为 PASS 或 PASS WITH NOTES。

G3 不表示：

- 已有 Runtime/Cocos Inspector。
- 已完成视觉验证。
- 已安装全局 MCP 配置。
- 已开始 G4 或 G5。

G3 通过后，默认下一阶段是 G5 Agent Evals；G4 Runtime 仍需用户依据真实需求单独批准。

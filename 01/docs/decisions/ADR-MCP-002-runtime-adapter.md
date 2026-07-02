# ADR-MCP-002: Runtime Adapter 技术选型

> 状态：Draft — 等待审查  
> 日期：2026-07-01  
> 决策者：G4.1 预研 AI  
> 阶段：G4.1 预研版  
> 前置：G3 MCP 已实施（等待独立验收）

## 1. 背景

G3 `linkup-dev-mcp` 提供了三个静态只读 Tools 和四个 Resources，能回答"项目文件里写了什么"的问题。但 LinkUpClient 是一个运行中的 Cocos Creator 2.4.15 游戏项目，许多开发任务需要回答"运行时发生了什么"的问题。

本 ADR 评估是否需要、以及如何实现 G4 Runtime Adapter，使 MCP 能在不修改业务代码的前提下观察 Cocos Creator 预览运行态。

## 2. 真实需求确认

以下三个任务来自 LinkUpClient 的实际开发模式，证明 G3 静态能力不足以覆盖：

### 任务 1：运行时 UI 状态验证

**场景**：开发者修改了 `UISet.prefab` 的节点结构或 `UISetUICtrl.ts` 的按钮绑定。  
**G3 能做的**：静态检查 prefab JSON 结构、节点路径存在性、组件注册关系。  
**G3 不能做的**：
- 验证 UI 实例在运行时是否真的被 `UIManager` 正确加载
- 验证 `addComponent` 动态挂载的组件是否执行成功
- 验证按钮点击事件是否在运行时正确触发
- 验证 UI 在不同分辨率下的实际渲染效果

**为什么必须运行态**：LinkUpClient 的 UI 控制器使用 `this.node.getComponent(...)` 动态查找组件，`UIManager` 通过 `cc.instantiate(prefab)` 动态创建 UI 实例。这些行为只有在运行时才能观察。

### 任务 2：游戏运行时错误诊断

**场景**：游戏预览时控制台出现错误或 UI 显示异常。  
**G3 能做的**：分析 TypeScript 源码中的潜在问题（如不存在的节点路径）。  
**G3 不能做的**：
- 读取浏览器控制台的 `console.log/warn/error` 输出
- 获取运行时 `cc.director.getScene()` 的场景树
- 检查某个节点的 `active`、`position`、`opacity` 等运行时属性
- 捕获预览截图用于视觉对比

**为什么必须运行态**：许多 bug 表现为运行时错误（如"Cannot read property of null"），只能在控制台日志中看到。静态分析无法预测运行时数据流。

### 任务 3：动态场景切换验证

**场景**：游戏从登录场景切换到游戏场景，需要验证 UI 层级和 Manager 单例状态。  
**G3 能做的**：列出项目中有哪些 `.fire` 场景文件。  
**G3 不能做的**：
- 确认当前运行的是哪个场景
- 验证场景切换后 `UIManager` 的 UI 栈状态
- 检查全局 Manager 单例是否正确初始化
- 验证事件监听器是否正确注册和触发

**为什么必须运行态**：场景切换和 Manager 初始化是运行时行为，静态文件只能声明结构，不能证明执行结果。

### 需求结论

三个任务均证明：仅靠 G3 静态 MCP 无法完成需要运行态观察的开发任务。G4 Runtime 有真实的必要性——但前提是技术方案可行、安全可控、且不影响正式构建。

## 3. 技术 Spike 结论

基于对 Cocos Creator 2.4.15 预览机制的研究和当前环境验证：

| Spike 问题 | 结论 | 证据 |
|---|---|---|
| 1. 能否连接到 Cocos 2.4.15 预览环境？ | **是** | Cocos Creator 2.4.15 已安装在 `/Applications/Cocos/Creator/2.4.15/`。浏览器预览模式在 Chrome 中运行游戏网页，支持 CDP 连接。 |
| 2. 能否读取 `cc.director.getScene()`？ | **是** | Cocos 2.4.x 浏览器预览中 `cc` 作为全局对象暴露。`cc.director.getScene()` 返回当前场景节点。可通过 CDP `Runtime.evaluate` 执行。 |
| 3. 能否稳定序列化节点树？ | **是（需限制）** | `cc.director.getScene().children` 可递归遍历。但需限制深度和节点数（防止序列化过大的树）。Cocos 节点有 `_children`、`_components`、`name`、`active`、`position` 等可序列化属性。 |
| 4. 能否读取控制台日志？ | **是** | CDP `Runtime.consoleAPICalled` 事件可捕获所有 `console.log/warn/error` 调用。浏览器预览中 `cc.log/warn/error` 最终调用 `console.*`。 |
| 5. 能否捕获预览截图？ | **是** | CDP `Page.captureScreenshot` 返回 base64 PNG。无需修改游戏代码。 |
| 6. 需要什么前提条件？ | **见下文** | 需要 Cocos Creator 编辑器运行并启动浏览器预览；Chrome 以 `--remote-debugging-port` 启动；puppeteer 或 chrome-remote-interface 库。 |

### 前提条件详情

- **Cocos Creator 编辑器**：必须运行并点击"浏览器预览"（不可 headless 启动预览）
- **Chrome 启动参数**：`--remote-debugging-port=9222`（或通过 Cocos 偏好设置配置）
- **端口**：默认预览端口可配置（偏好设置 → 通用设置 → 预览服务器端口号）
- **注入权限**：不需要注入代码到游戏；通过 CDP `Runtime.evaluate` 在页面上下文执行
- **调试权限**：CDP 需要 Chrome 以调试模式启动
- **开发态前提**：仅在开发态（Cocos 编辑器预览）可用；正式构建不包含预览服务器

## 4. 候选方案对比

### 方案 A：浏览器预览 + CDP/自动化

**原理**：Cocos Creator 浏览器预览在 Chrome 中运行游戏网页。通过 CDP (Chrome DevTools Protocol) 连接到 Chrome，执行 JavaScript 访问 `cc` 全局对象。

**实现路径**：
1. Cocos Creator 编辑器启动浏览器预览
2. Chrome 以 `--remote-debugging-port` 启动
3. MCP Runtime Adapter 通过 CDP 连接 Chrome
4. 通过 `Runtime.evaluate` 执行 `cc.director.getScene()` 等 API
5. 通过 `Runtime.consoleAPICalled` 监听日志
6. 通过 `Page.captureScreenshot` 截图

**优点**：
- ✅ 不修改 LinkUpClient 业务代码
- ✅ 不需要在游戏项目中注入任何 Bridge 脚本
- ✅ 利用完整的 Chrome DevTools 能力（截图、日志、性能分析）
- ✅ 正式构建天然不包含预览服务器，无需额外隔离
- ✅ 安全边界清晰：CDP 仅在本地调试模式可用

**缺点**：
- ❌ 依赖 Cocos Creator 编辑器运行（GUI 依赖）
- ❌ 需要 puppeteer 或 chrome-remote-interface 依赖
- ❌ CDP 连接需要 Chrome 调试端口配置
- ❌ 节点序列化需要自行处理循环引用和深度限制
- ❌ `cc` 全局对象的 API 在不同 Cocos 版本间可能变化

**是否需要修改 LinkUpClient**：**否**

### 方案 B：开发态 Runtime Bridge

**原理**：在 LinkUpClient 的 `assets/Scripts/Dev/` 目录中添加一个轻量 Bridge 脚本，通过 WebSocket 或 HTTP 与 MCP Server 通信，暴露运行时 API。

**实现路径**：
1. 在 `01/LinkUpClient/assets/Scripts/Dev/RuntimeBridge.ts` 创建 Bridge 组件
2. Bridge 在游戏启动时连接到本地 WebSocket 服务
3. MCP Runtime Adapter 启动 WebSocket 服务端
4. 通过 Bridge 执行 `cc.director.getScene()` 等 API
5. Bridge 将结果通过 WebSocket 返回

**优点**：
- ✅ 直接访问 Cocos API，无需 CDP 中间层
- ✅ 可以精确定制需要暴露的 API
- ✅ 不依赖 Chrome 调试端口

**缺点**：
- ❌ **必须修改 LinkUpClient** — 在 `assets/Scripts/Dev/` 添加代码
- ❌ Bridge 脚本会进入正式构建，必须确保条件编译或构建时排除
- ❌ 需要额外的安全审查：WebSocket 端口暴露、代码注入风险
- ❌ 增加了游戏代码与开发工具的耦合
- ❌ 如果构建排除失败，正式包会包含调试代码

**是否需要修改 LinkUpClient**：**是** — 需要在 `assets/Scripts/Dev/` 添加 Bridge 脚本

### 方案 C：Cocos Creator 编辑器扩展

**原理**：通过 Cocos Creator 2.4.x 的扩展包机制，创建一个编辑器扩展，利用编辑器内部 API 访问运行时状态。

**实现路径**：
1. 创建 Cocos Creator 扩展包
2. 扩展通过编辑器消息系统与预览窗口通信
3. MCP Server 与扩展通过本地 socket 通信

**优点**：
- ✅ 利用编辑器原生能力
- ✅ 可以访问编辑器内部 API

**缺点**：
- ❌ Cocos Creator 2.4.x 的扩展 API 文档有限
- ❌ 编辑器扩展与 MCP Server 的通信链路复杂
- ❌ 扩展 API 稳定性不确定
- ❌ 强依赖特定 Cocos Creator 版本
- ❌ 调试和维护成本高

**是否需要修改 LinkUpClient**：**否**（修改的是编辑器环境）

## 5. 推荐方案

### 推荐：方案 A — 浏览器预览 + CDP/自动化

**理由**：

1. **零业务代码侵入**：这是总计划中最重要的约束之一。方案 A 完全不需要修改 LinkUpClient，而方案 B 必须在 `assets/Scripts/Dev/` 添加代码。

2. **安全边界天然清晰**：
   - CDP 仅在 Chrome 调试模式下可用（`--remote-debugging-port`）
   - 正式构建不包含预览服务器
   - 不需要"构建时排除"机制

3. **能力完整**：CDP 提供了所有 Spike 问题所需的能力——JavaScript 执行、日志捕获、截图。

4. **技术成熟**：puppeteer 和 CDP 是成熟的浏览器自动化技术。

5. **可扩展**：后续可以利用 CDP 的其他能力（网络监控、性能分析）而不需要修改游戏代码。

### 否决方案

#### 否决：方案 B — 开发态 Runtime Bridge

**原因**：
- 违反"不修改 LinkUpClient"的核心约束（除非获得单独批准）
- 正式构建隔离是高风险点——如果条件编译失败，调试代码会进入正式包
- 增加了游戏代码与开发工具的耦合，不利于维护

#### 否决：方案 C — Cocos Creator 编辑器扩展

**原因**：
- Cocos Creator 2.4.x 扩展 API 文档不充分
- 实现复杂度高，调试困难
- 强依赖特定编辑器版本，升级风险大

## 6. 权限面分析

### 方案 A 权限需求

| 权限 | 说明 | 风险级别 |
|---|---|---|
| Chrome 调试端口 | `--remote-debugging-port=9222` 本地端口 | 低 — 仅本地访问 |
| Cocos Creator 编辑器 | 编辑器必须运行并启动预览 | 低 — 开发态正常流程 |
| Node.js puppeteer | 安装 puppeteer 或 chrome-remote-interface | 低 — 官方 npm 包 |
| 页面 JavaScript 执行 | 通过 CDP 在预览页面执行 JS | 中 — 需要白名单限制 |

### 安全措施

1. **端口绑定**：CDP 端口仅绑定 `127.0.0.1`，不监听 `0.0.0.0`
2. **JavaScript 白名单**：MCP Runtime Tool 只允许执行预定义的 `cc.*` 查询，不接受任意 JS
3. **无写入能力**：Runtime Adapter 只读，不提供修改游戏状态的 API
4. **超时控制**：每次 CDP 执行设置超时，防止挂起

## 7. 安全边界

### 进程边界
- CDP 连接由 MCP Runtime Adapter 主动发起
- 不创建监听端口（MCP 侧）
- CDP 端口由 Chrome 管理，仅本地可用

### 数据边界
- 只读取 `cc.*` 运行时 API，不读取文件系统
- 截图数据直接返回给 MCP 客户端，不持久化
- 日志数据实时流式返回，不缓存

### 代码执行边界
- **允许**：`cc.director.getScene()`、`cc.director.getScene().getChildByName()` 等只读查询
- **禁止**：`eval()`、`Function()`、任意 JavaScript 执行
- **禁止**：修改节点属性、调用游戏方法、触发事件

### 正式构建隔离
- **天然隔离**：浏览器预览服务器仅在 Cocos Creator 编辑器运行时存在
- **正式构建产物**：不包含预览服务器、不包含 CDP 端口、不包含调试代码
- **无需额外机制**：与方案 B 不同，方案 A 不需要条件编译或构建排除

## 8. 发布隔离策略

| 隔离层面 | 策略 |
|---|---|
| 代码层 | Runtime Adapter 代码仅在 `01/mcp/linkup-dev-mcp/src/runtime/` 中，不影响 MCP Server 非 Runtime 功能 |
| 配置层 | Runtime Adapter 默认禁用，需显式配置启用 |
| 构建层 | LinkUpClient 正式构建不包含任何 Runtime Bridge 代码（因为方案 A 不修改业务代码） |
| 运行时层 | CDP 仅在 Chrome 调试模式可用，正式用户不会以调试模式启动浏览器 |
| MCP 协议层 | `runtime_status` 始终注册在 `tools/list` 中，未连接时调用返回 `disconnected`（2 秒内）；其他 Runtime Tools 始终注册，未连接时返回 `RUNTIME_UNAVAILABLE`。这与总计划 G4-01 验收项对齐 |

## 9. Runtime Tools 注册策略（对齐 G4-01）

总计划 G4-01 验收项明确要求："未连接状态：无预览调用 status，2 秒内明确 disconnected"。

这意味着 `runtime_status` **必须始终出现在 `tools/list` 中**，无论 Runtime Adapter 是否已连接到 Cocos 预览。这与之前 Spike 报告中"仅在连接时出现"的设计不同，已在本轮修正。

### 注册策略

| Tool | 未连接时 | 已连接时 |
|---|---|---|
| `runtime_status` | `ok: true, data: { status: "disconnected" }` （2 秒内） | `ok: true, data: { status: "connected", scene, resolution }` |
| `runtime_scene_tree` | `ok: false, error: { code: "RUNTIME_UNAVAILABLE" }` | `ok: true, data: { tree, ... }` |
| `runtime_node_detail` | `ok: false, error: { code: "RUNTIME_UNAVAILABLE" }` | `ok: true, data: { node, ... }` |
| `runtime_console_logs` | `ok: false, error: { code: "RUNTIME_UNAVAILABLE" }` | `ok: true, data: { logs, ... }` |
| `runtime_capture_preview` | `ok: false, error: { code: "RUNTIME_UNAVAILABLE" }` | `ok: true, data: { screenshot, ... }` |

### 设计理由

1. MCP `tools/list` 返回的是 Server 的能力声明，不是连接状态。Host 在初始化时获取工具列表，之后通常缓存。
2. 如果 Runtime Tools 仅在连接后出现，Host 需要订阅 `listChanged` 才能感知新工具——这增加了协议复杂度。
3. G4-01 明确要求"未连接状态调用 status"，隐含 `runtime_status` 在未连接时也可调用。
4. 未连接时返回结构化错误（而非隐藏工具）是更可预测的行为。

## 10. 是否需要修改 LinkUpClient

**方案 A（推荐）：否。** 完全不需要修改 LinkUpClient 业务代码。所有 Runtime 观察能力通过 CDP 连接到浏览器预览实现。

如果未来评估后认为方案 A 不可行而必须采用方案 B，则需要单独提交偏差请求，获得对 `01/LinkUpClient/assets/Scripts/Dev/` 的写入授权。

## 11. 对 G4.2 正式实现的建议

### 建议进入 G4.2 的前提条件

1. 本 ADR 获得批准
2. G3 独立验收通过（当前等待第 2 轮验证）
3. 用户确认接受 Cocos Creator 编辑器运行时依赖
4. 用户确认接受 puppeteer 或 chrome-remote-interface 依赖

### G4.2 预估工作范围

| 工作包 | 内容 | 预估工作量 |
|---|---|---|
| G4.2-P0 | CDP 连接管理（connect/disconnect/reconnect） | 小 |
| G4.2-P1 | `runtime_status` Tool | 小 |
| G4.2-P2 | `runtime_scene_tree` Tool（含深度/节点限制） | 中 |
| G4.2-P3 | `runtime_node_detail` Tool | 中 |
| G4.2-P4 | `runtime_console_logs` Tool | 小 |
| G4.2-P5 | `runtime_capture_preview` Tool | 小 |
| G4.2-P6 | 安全硬化（JS 白名单、超时、错误处理） | 中 |
| G4.2-P7 | 测试（单元、集成、安全） | 中 |
| G4.2-P8 | 文档和提交包 | 小 |

### 独立验收时需要复跑的命令

```bash
# MCP 构建和测试
cd 01/mcp/linkup-dev-mcp
npm ci
npm run typecheck
npm run build
npm test

# Runtime 专项测试（需要 Cocos Creator 运行中）
node --test dist/test/runtime/**/*.test.js

# 验证 Runtime Tools 可见性（与 G4-01 对齐）
# 1. 不启动 Cocos → tools/list 包含 runtime_status 等 Runtime Tools
# 2. 不启动 Cocos → 调用 runtime_status 返回 disconnected（2秒内）
# 3. 启动 Cocos 预览 → 调用 runtime_status 返回 connected
# 4. 启动 Cocos 预览 → runtime_scene_tree 等返回实际数据

# 验证正式构建无 Runtime 代码
# 构建 LinkUpClient Web 版 → 检查产物不含 Bridge/debug 代码
```

## 12. 决策记录

| 项目 | 决策 |
|---|---|
| 推荐方案 | 方案 A：浏览器预览 + CDP |
| 否决方案 | 方案 B（需改业务代码）、方案 C（复杂度高） |
| 是否需要修改 LinkUpClient | 否（方案 A） |
| 正式构建隔离 | 天然隔离，无需额外机制 |
| 安全模型 | CDP 本地端口 + JS 白名单 + 只读 |
| Runtime Tools 可见性 | 始终注册在 tools/list 中；未连接时 runtime_status 返回 disconnected，其他返回 RUNTIME_UNAVAILABLE（对齐 G4-01） |
| G4 前置条件 | G3 验收通过 + 本 ADR 批准 |
| 风险接受项 | 依赖 Cocos Creator 编辑器运行 |

## 13. 附录：环境验证

```
Cocos Creator 2.4.15: ✅ 已安装 (/Applications/Cocos/Creator/2.4.15/)
Google Chrome: ✅ 已安装 (/Applications/Google Chrome.app/)
Node.js: v22.22.2
npm: 10.9.7
LinkUpClient 项目: 01/LinkUpClient/ (Cocos 2.4.15, 1 scene: LinkUp.fire)
G3 MCP: 已实施（等待独立验收）
```

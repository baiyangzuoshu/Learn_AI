# Deno Agent 产品策划

Deno Agent 的产品定位是：本地优先的开发者 Agent 客户端。

它不是单纯的 Harness 教学项目，也不是云端
IDE。它的核心价值是把模型对话、代码工作区、工具调用、权限控制、MCP/Skill
扩展和发布更新做成一个可安装、可持续使用的桌面客户端。

## 产品定位

Deno Agent 面向需要在本地项目中使用 AI Agent
的开发者。用户可以选择一个工作区，围绕这个工作区进行对话、读取文件、修改代码、运行命令、查看 Git
改动、调用 MCP 工具，并在权限可控的前提下让 Agent 完成多步骤任务。

一句话定位：

```text
一个轻量、开源、本地优先的 Agent 客户端。
```

## 目标用户

- 个人开发者：希望用 AI 辅助阅读项目、改代码、跑命令、整理任务。
- Agent 学习者：希望理解 Agent loop、tool use、permission、memory、MCP、subagent 等机制。
- 工具开发者：希望基于一个清晰的本地客户端集成自己的 MCP 服务、Skill 或自动化工具。
- 开源贡献者：希望参与一个无 Electron、低依赖、可审计的 Agent 客户端。

## 产品边界

Deno Agent 做：

- 本地桌面客户端。
- 多工作区和多会话管理。
- Agent 对话、工具调用和权限控制。
- 文件、Shell、Git、MCP、Skill、Memory、Todo、定时任务。
- 模型 Provider 配置和用量遥测。
- GitHub Release 自动更新。

Deno Agent 暂不做：

- 云端多租户服务。
- 浏览器托管 IDE。
- 模型训练或模型托管。
- 团队账号、组织权限和云同步。
- 完整插件市场和远程扩展分发。

## 核心场景

### 1. 项目阅读

用户选择一个本地项目，向 Agent 提问：

- 入口文件在哪里？
- 这个模块怎么分层？
- 某个功能的数据流是什么？
- 哪些文件和这个问题相关？

客户端需要提供清晰的 Markdown 阅读排版、可展开工作区、文件树和 Git 信息。

### 2. 代码修改

Agent 可以在权限控制下：

- 读取文件。
- 生成补丁。
- 编辑文件。
- 运行检查命令。
- 汇总变更。

输入框上方展示当前任务进度和 Git 改动摘要，帮助用户判断 Agent 是否在正确范围内工作。

### 3. 工具与自动化

Agent 可以使用：

- Shell。
- Todo。
- Memory。
- Task graph。
- Background tasks。
- Scheduled conversations。
- MCP tools。
- Skills。

所有会改变系统状态的工具都要走权限策略。

### 4. 多 Agent 编排

在需要时，Agent 可以使用 Subagent、Team 和 bounded autonomous loop
处理复杂任务。编排能力必须可控，不能形成无限递归或不可解释的后台行为。

### 5. 本地发布和更新

开发者可以通过本地 token 或 GitHub Actions 发布 Release。用户可以在客户端里检查更新、下载
zip、退出当前 App、替换 `.app` 并重新打开。

## 当前版本能力

| 模块       | 当前状态                                         |
| ---------- | ------------------------------------------------ |
| 桌面客户端 | Deno Desktop + 系统 WebView                      |
| 模型       | DeepSeek Provider，可配置模型列表                |
| 工作区     | 多工作区、多会话、文件树、Git 概览               |
| 工具       | 文件、Shell、Todo、Memory、任务图、后台任务      |
| 扩展       | MCP、Skill                                       |
| 编排       | Subagent、Team、Autonomous bounded loop          |
| 权限       | `ask`、`auto`、`full` 三档权限模式               |
| 更新       | GitHub Release 检查和 macOS `.app` 下载重启替换  |
| 发布       | 本地 GitHub token 脚本和 GitHub Actions workflow |

## 路线图

### v1：稳定本地 Agent 客户端

- 完善 README、架构、部署和贡献文档。
- 稳定 macOS arm64 发布和自动更新。
- 完善错误提示、权限提示和更新失败诊断。
- 明确 release asset、版本号和 changelog 规范。

### v1.x：更好的客户端体验

- Provider 抽象：支持更多 OpenAI-compatible Provider。
- 更完整的设置页：模型、MCP、Skill、权限、外观、更新。
- 更强的工作区面板：文件预览、Git diff、提交摘要。
- 更清晰的工具调用 UI：输入、输出、失败、重试、权限记录。

### v2：可扩展 Agent 平台

- 跨平台自动更新策略。
- 插件/Skill 分发规范。
- 项目级 Agent 配置文件。
- 可导入导出的工作区配置。
- 更完整的审计日志和安全策略。

## 开源策略

项目开源时应强调：

- 轻量：不依赖 Electron。
- 可审计：核心 Agent loop、权限、工具注册都在 TypeScript 中。
- 本地优先：用户数据默认留在本机。
- 可扩展：通过 MCP、Skill 和 Feature 模块扩展能力。
- 可学习：`stages/` 作为内部演进示例保留，但产品定位是客户端。

## 成功标准

- 新用户能在 10 分钟内跑起桌面客户端。
- 开发者能看懂架构文档并定位入口。
- 贡献者能知道新增工具应该放在哪个 Feature。
- 发布者能按部署文档完成版本更新和 GitHub Release 上传。
- 用户能从旧版本客户端完成一次“检查更新 → 下载并重启更新”。

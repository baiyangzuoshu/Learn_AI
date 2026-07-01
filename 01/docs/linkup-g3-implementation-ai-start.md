# G3 实施 AI 启动指令

将下面代码块完整复制给实施 AI。不要只发送“开始 G3”。

```text
阶段：G3
任务：实现 LinkUpClient 只读 stdio MCP Server。

你是实施 AI，不是规划 AI，也不是最终验收者。

开始前必须完整阅读：
1. 01/docs/linkup-g3-mcp-detailed-plan.md
2. 01/docs/linkup-ai-engineering-master-plan.md 中 G3、权限、证据和验收章节
3. 01/docs/linkup-mcp-implementation-plan.md（仅作通用背景；冲突时以 G3 详细计划为准）
4. 01/tools/linkup-check/package.json
5. 01/tools/linkup-check/src/index.mjs
6. 01/tools/linkup-check/src/project-index.mjs
7. 01/tools/linkup-check/src/prefab-parser.mjs
8. 01/tools/linkup-check/src/ts-extractor.mjs
9. 01/skill/linkup-client/SKILL.md 及三个 references（只读）

实施前先输出并锁定：
- G3 目标
- 允许写入路径
- 禁止写入路径
- 当前 git status
- G1/G2 前置状态
- Node/npm 版本
- SDK/协议核对结果
- 预期 changed-file list
- 风险与停止条件

严格范围：

允许写入：
- 01/mcp/linkup-dev-mcp/**
- 01/docs/decisions/ADR-MCP-001-sdk-and-protocol.md
- 01/docs/acceptance/G3-implementation-report-YYYYMMDD.md
- 仅为公共 re-export：
  - 01/tools/linkup-check/src/index.mjs
  - 01/tools/linkup-check/test/public-api.test.mjs

禁止写入：
- 01/LinkUpClient/**
- 01/skill/**
- 01/agent/**
- linkup-check 的规则、解析器、CLI、baseline 和既有测试预期
- 个人 Skill/MCP 配置
- G1/G2 验收记录和所有计划文档

必须按 G3-P0 到 G3-P8 顺序实施，每个工作包完成后运行对应测试。不得提前实现 Runtime、HTTP、Agent、通用文件、shell、eval、网络或写入能力。

关键技术约束：
- 使用 @modelcontextprotocol/sdk@1.29.0 精确版本。
- 禁止 v2 alpha。
- stdio only；stdout only MCP；日志写 stderr。
- 恰好三个 Tools：validate_project、inspect_ui_prefab、resolve_ui_contract。
- 恰好四个固定 Resources。
- MCP 从 linkup-check 包根复用公共接口，禁止深层 import 和复制规则。
- Tool 不接受 path、projectRoot、baselinePath、command、code 或 url。
- LinkUpClient 全程只读。

如果安装依赖需要网络权限，按环境正常请求权限，不改用非官方 SDK或手写 MCP 协议绕过。

发现下列情况立即停止并提交计划偏差请求：
- 需要修改预批准范围外的 G1 文件；
- @modelcontextprotocol/sdk@1.29.0 被撤回或有官方安全问题；
- 必须使用 v2 alpha、HTTP 或 Runtime 才能完成；
- 目标目录已有无法安全覆盖的用户工作；
- 需要修改 LinkUpClient 或 G2 Skill。

完成后必须：
1. npm ci
2. npm run typecheck
3. npm run build
4. npm test
5. 跑 G1 全部测试和真实项目检查
6. 用官方 SDK Client 或 MCP Inspector真实执行 initialize/list/call/read/close
7. 对比直接 runChecks 与 MCP validate_project
8. 验证 UISet、not-found、路径攻击、symlink 和 stdout
9. 对比 LinkUpClient 前后 git status 与 hash
10. 删除所有临时目录和进程
11. 写 01/docs/acceptance/G3-implementation-report-YYYYMMDD.md

实施报告必须提供真实命令、输出摘要、exit code、协议 transcript、依赖版本、changed-file list、偏差、限制和独立验收命令。

不要 commit、push、安装全局 MCP、启动 G4/G5，除非用户另行授权。
不要自我宣布 G3 PASS。完成后只报告“等待独立验收”。
```

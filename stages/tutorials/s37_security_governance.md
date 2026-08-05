# s37：安全治理与威胁建模

## 要解决的问题

Agent
的风险来自数据流和工具副作用，而不仅是模型本身。一个读取工具、一个写文件工具和一个外部请求工具应有不同的审批、审计和输出处理。

## 代码地图

- `classifyTool`：将工具归类为 read/write/external/dangerous。
- `authorize`：用 reader/editor/admin 展示最小权限 ACL。
- `detectPromptInjection`：识别典型的“忽略指令、泄露系统提示、关闭安全”信号。
- `redactSecrets`：在日志和模型可见输出前遮蔽 token。

## 运行

```sh
deno check stages/s37_security_governance.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s37_security_governance.ts
```

用 `security_governance_check` 传入 `tool=delete_file`、`role=editor` 和包含 `sk-...`
的文本，检查风险、拒绝结果、注入信号和脱敏文本是否同时出现。

## 威胁模型清单

1. 输入：网页、文件和 MCP 返回值都可能包含指令注入。
2. 权限：模型不能升级自己的 role，也不能跳过 `ask`。
3. 数据：密钥、对话和个人信息不能进入日志、Trace 或错误响应。
4. 网络：远程端点、重定向和 SSRF 要有明确 allowlist。
5. 资源：命令、文件、并发和输出都要有上限。

## 练习

- 增加路径校验，拒绝工作区外的文件。
- 为外部请求增加域名 allowlist 和超时。
- 为每次拒绝记录 reason code，但不记录秘密原文。

## 与生产的边界

正则和内存 ACL 只是教学替身。生产需要集中权限策略、密钥存储、审计保留策略、沙箱和安全测试；所有
mutating 工具都应在运行时再次分类。

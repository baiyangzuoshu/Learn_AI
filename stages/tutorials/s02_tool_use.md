# s02：通用工具调用

源码：[s02_tool_use.ts](../s02_tool_use.ts)

## 学习目标

- 理解 `ToolDefinition` 与 `ToolHandler` 的分工。
- 掌握工具注册、查找、参数解析和结果回填。
- 理解文件工具为什么必须限制工作区路径。

## 核心机制

本阶段将工具定义和处理函数分离，并注册 `bash`、`read_file`、`write_file`、`edit_file`。工具定义作为
JSON Schema 发给模型；Handler 留在本地执行。`registerTool()` 用工具名把两者绑定起来。

## 工具的三层契约

可靠工具同时有三份契约：给模型看的 `ToolDefinition`、执行前的运行时输入校验、真正产生效果的
`ToolHandler`。JSON Schema 能提高参数质量，但模型输出仍是不可信输入，Handler
必须检查类型、空值、长度、路径与副作用。

`definitions` 是模型可见的能力目录，`handlers` 是本地可信执行面。`registerTool()`
把同名定义和处理器绑定，因此以后新增工具不需要给 `agentLoop()`
增加分支。失败结果也要回填模型，使其能够修正参数或换一种行动。

源码中的 `safePath()` 先规范化路径，再用 `relative()` 判断是否逃逸工作区；简单字符串前缀会被 `../`
和相似目录名绕过。`read_file` 控制输出，`write_file` 与 `edit_file` 产生持久副作用，`executeTool()`
统一完成查找、授权、Hook 和错误格式化。

设计新工具时要逐项回答：模型能否准确选择它？参数是否足够窄？权限类别是什么？输出是否有界？取消信号能否抵达真实
I/O？

## 运行与观察

```sh
deno task s02
```

依次尝试读取文件、写入临时文件和精确替换文本。观察模型参数并不可信，Handler 仍需校验输入。

## 练习

新增 `file_stat`：先写 Schema，再写运行时校验与 Handler，最后注册。故意传入
`../../etc/passwd`，确认路径校验发生在执行时，并限制返回的元数据大小。

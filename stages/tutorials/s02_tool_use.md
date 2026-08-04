# s02：通用工具调用

源码：[s02_tool_use.ts](../s02_tool_use.ts)

## 学习目标

- 理解 `ToolDefinition` 与 `ToolHandler` 的分工。
- 掌握工具注册、查找、参数解析和结果回填。
- 理解文件工具为什么必须限制工作区路径。

## 核心机制

本阶段将工具定义和处理函数分离，并注册 `bash`、`read_file`、`write_file`、`edit_file`。工具定义作为
JSON Schema 发给模型；Handler 留在本地执行。`registerTool()` 用工具名把两者绑定起来。

## 运行与观察

```sh
deno task s02
```

依次尝试读取文件、写入临时文件和精确替换文本。观察模型参数并不可信，Handler 仍需校验输入。

## 练习

新增一个只返回文件元数据的 `file_stat` 工具，并限制输出长度。

# C 第 1 课：Agent Loop

这一课把 `stages/s01_agent_loop` 的最小闭环迁移到 C：

```text
用户 → DeepSeek → bash tool_call → Shell → tool result → DeepSeek → 最终回答
```

## 模块结构

```text
C/
├── include/
│   ├── agent.h       # Agent Loop 编排和事件
│   ├── deepseek.h    # Provider 接口
│   ├── http.h        # libcurl HTTP 传输
│   ├── messages.h    # 消息和 tool call 模型
│   ├── shell_tool.h  # Bash 工具
│   └── tool.h        # Tool Registry
├── src/
│   ├── agent.c
│   ├── deepseek.c
│   ├── http.c
│   ├── main.c
│   ├── messages.c
│   ├── shell_tool.c
│   └── tool.c
└── Makefile
```

macOS 打包资源位于 `macos/Info.plist`。

## 依赖

- C11 编译器
- libcurl
- cJSON

macOS Homebrew 环境通常可以直接使用：

```sh
brew install curl cjson
```

## 编译

```sh
cd C
make check
```

构建当前 Mac 架构的 macOS 原生版本：

```sh
cd C
make macos
```

输出：`dist/macos-arm64/agent-s01`。构建 `.app`：

```sh
make macos-app
```

输出：`dist/macos-arm64/AI Agent.app`。这是一个命令行 Agent，启动时仍需要从终端继承
`DEEPSEEK_API_KEY`；`.app` 主要用于 macOS 原生交付和后续签名。

## 运行

```sh
export DEEPSEEK_API_KEY="你的 DeepSeek API Key"
cd C
make run QUERY="查看当前目录有哪些文件"
```

也可以直接运行后从 stdin 输入一条任务：

```sh
./build/agent-s01
```

可选环境变量：

- `DEEPSEEK_MODEL`，默认 `deepseek-chat`
- `DEEPSEEK_BASE_URL`，默认 `https://api.deepseek.com`

第 1 课只证明 Agent Loop 的最小闭环。权限审批、取消传播、持久化和更细的预算控制留到后续课程逐步加入。

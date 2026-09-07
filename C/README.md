# C 第 1 课：Agent Loop

这一课把 `stages/s01_agent_loop` 的最小闭环迁移到 C：

```text
用户 → DeepSeek → bash tool_call → Shell → tool result → DeepSeek → 最终回答
```

## 模块结构

```text
C/
├── base/              # 通用数据结构和基础工具
│   ├── list.h/.c      # 单向链表
│   ├── queue.h/.c     # FIFO 队列
│   ├── stack.h/.c     # LIFO 栈
│   ├── vector.h/.c    # 动态数组
│   ├── hash_map.h/.c  # 字符串键哈希表
│   ├── string_builder.h/.c # 字符串构建器
│   ├── ring_buffer.h/.c # 固定容量环形缓冲区
│   └── priority_queue.h/.c # 二叉堆优先队列
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
├── tests/
│   └── test_collections.c
└── Makefile
```

## 基础容器

`base/` 目录集中放置通用数据结构和基础工具。`list.h`、`queue.h`、`stack.h`、`vector.h`、`hash_map.h`、`ring_buffer.h` 和
`priority_queue.h` 是后续 Agent 功能共用的基础容器。它们保存 `void *`，
由创建容器时传入的 `CollectionFreeFn` 负责释放元素。元素成功插入后，所有权交给容器；
`pop` 操作会把所有权交还给调用方，调用方需要负责释放返回值。

`StringBuilder` 专门负责可增长的 UTF-8 字节字符串，支持普通追加、追加指定长度、追加字符
和格式化追加。`HashMap` 使用字符串键和开放寻址，`PriorityQueue` 使用二叉堆，并复用
`Vector` 的存储层。环形缓冲区容量固定，满时会拒绝新元素，适合流式输出和事件缓冲。

```sh
make test
```

当前消息历史仍使用专用的 `MessageList` 动态数组，因为 DeepSeek 请求需要按索引遍历消息；
后续可以逐步把工具注册表、事件缓冲、任务调度和 Prompt 拼接迁移到这些基础模块上。

macOS 桌面层按职责拆分：`macos/launcher.m` 负责窗口和进程，`macos/secret_store.m` 负责凭据，
`macos/chat_view.m` 与 `macos/renderer/` 负责对话和 Markdown 渲染。`.app` 启动
`Resources/agent-s01`；Agent 核心仍然全部使用 C 实现。对话区支持标题、强调、列表、表格、
引用、行内代码和代码块，不会显示未经渲染的 Markdown 标记。

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

输出：`dist/macos-arm64/AI Agent.app`。从 Finder 双击后只打开对话窗口，不会连接 DeepSeek。
启动后可通过“选择目录”指定 Agent 的工作目录，Agent 的文件工具和命令都会在该目录中执行。
输入任务并点击“发送”后，如果还没有 Key，才会弹出设置窗口；保存后的 Key 会写入当前用户的
`~/Library/Application Support/AI Agent C/data/deepseek.key`，下次打开应用无需重新设置，
也可以随时点击“设置 Key”。数据目录权限为 `700`，Key 文件权限为 `600`，不会写入仓库或 App 包。
环境变量 `DEEPSEEK_API_KEY` 仍然兼容直接运行二进制的方式。

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

# s20：综合 Desktop Harness

源码：[s20_comprehensive.ts](../s20_comprehensive.ts)

## 学习目标

- 回顾 s01–s19 如何组合为完整 Harness。
- 使用能力清单和自检工具诊断运行环境。
- 理解教学综合层与生产组合入口的边界。

## 核心机制

`harness_status` 返回阶段能力清单，`harness_self_check` 检查工作区、模型、API
Key、系统提示和持久化目录。综合提示要求选择最小充分能力并验证结果。

## 运行与观察

```sh
deno task s20
```

先调用状态工具，再运行自检；区分能力“声明”和实际运行检查。

## 练习

让能力清单从实际注册工具动态生成，并为每项能力附加健康状态。

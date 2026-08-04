# s18：Git Worktree 隔离

源码：[s18_git_worktree.ts](../s18_git_worktree.ts)

## 学习目标

- 使用 Worktree 隔离并行代码修改。
- 掌握创建、列出、运行 Agent 和安全删除。
- 防止删除包含未提交改动的工作区。

## 核心机制

`worktree_create` 创建独立目录和分支，`worktree_agent` 将同一个 Agent Loop
的工作区切换到该目录，`worktree_remove` 仅删除干净 Worktree。

## 两种隔离缺一不可

任务 ID 隔离的是目标和状态，Git worktree 隔离的是文件系统。多个 Agent
在同一目录并行写文件，即使任务描述完全独立，也可能覆盖修改、污染索引或运行到彼此的中间状态。

`worktree_create` 为任务建立独立分支和目录；`worktree_agent` 显式把工作区传给同一个 Agent
Loop；`worktree_remove` 在删除前确认它由 Harness
管理、路径安全且没有未提交修改。工作区必须显式传递，不能靠进程全局 `cwd` 猜测。

创建和删除都属于外部副作用，需要审批。路径、分支名和任务 ID
必须校验；删除不能依赖模型声称“已经保存”。应用重启后，内存记录会丢失，应通过
`git worktree list --porcelain` 恢复，并核对允许的管理根目录。

worktree 解决隔离，不自动解决合并。最终仍要检查冲突、测试修改并以可审计方式集成目标分支。

## 运行与观察

```sh
deno task s18
```

在 Git 仓库中创建测试 Worktree，制造未提交修改并确认删除被拒绝。

## 练习

实现重启恢复和管理根校验；为有未提交修改、已删除分支、目录被手工移动三种情况编写测试。最后设计安全合并与冲突上报流程。

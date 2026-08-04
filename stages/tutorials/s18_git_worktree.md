# s18：Git Worktree 隔离

源码：[s18_git_worktree.ts](../s18_git_worktree.ts)

## 学习目标

- 使用 Worktree 隔离并行代码修改。
- 掌握创建、列出、运行 Agent 和安全删除。
- 防止删除包含未提交改动的工作区。

## 核心机制

`worktree_create` 创建独立目录和分支，`worktree_agent` 将同一个 Agent Loop
的工作区切换到该目录，`worktree_remove` 仅删除干净 Worktree。

## 运行与观察

```sh
deno task s18
```

在 Git 仓库中创建测试 Worktree，制造未提交修改并确认删除被拒绝。

## 练习

应用重启后通过 `git worktree list` 恢复托管记录。

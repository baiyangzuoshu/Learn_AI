# G1 Independent Acceptance Record

> Date: 2026-07-02  
> Phase: G1 Tools  
> Acceptance Role: Independent Acceptance AI  
> Status: PASS

## 1. Actual Files Checked

- `01/tools/linkup-check/package.json`
- `01/tools/linkup-check/bin/linkup-check.mjs`
- `01/tools/linkup-check/src/**`
- `01/tools/linkup-check/test/**`
- `01/tools/linkup-check/linkup-check.baseline.json`
- `01/docs/acceptance/G1-acceptance-20260630.md`

## 2. Commands Actually Re-run

```bash
cd 01/tools/linkup-check
node --test test/*.test.mjs
```

Result:

- 71 tests
- 71 pass
- 0 fail
- exit code 0

```bash
cd /Users/youjunmao/WORK/Learn_AI
node 01/tools/linkup-check/bin/linkup-check.mjs --help
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient --format json
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient --baseline 01/tools/linkup-check/linkup-check.baseline.json
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient -r ui/prefab-root-name
node 01/tools/linkup-check/bin/linkup-check.mjs --list-rules
```

Observed results:

- `--help` prints complete CLI help and exits 0
- real-project scan returns `Summary: 14 info, 14 baselined, 5 passed`
- JSON output is parseable and contains `diagnostics` + `summary`
- baseline run exits 0 and preserves known anomalies as baselined
- rule-filtered run on `ui/prefab-root-name` exits 0 and reports only baselined known issues
- `--list-rules` prints the expected 5 rules

## 3. Acceptance Against G1 Matrix

| ID | Item | Result |
|---|---|---|
| G1-01 | CLI 帮助 | PASS |
| G1-02 | 正常 fixture | PASS |
| G1-03 | 损坏 JSON | PASS (covered by test suite) |
| G1-04 | 根节点错名 | PASS |
| G1-05 | 缺失节点路径 | PASS (covered by test suite) |
| G1-06 | 非 Button 监听 | PASS (covered by test suite) |
| G1-07 | 注册缺失 | PASS (covered by test suite) |
| G1-08 | 重复挂载 | PASS |
| G1-09 | JSON 输出 | PASS |
| G1-10 | 基线 | PASS |
| G1-11 | 稳定性 | PASS (covered by test suite) |
| G1-12 | 真实项目 | PASS |

## 4. Notes

- The older self-test record `G1-acceptance-20260630.md` remained in `awaiting independent acceptance` state.  
  This new file is the independent acceptance result.
- Some command examples in the older report were only correct from repository root, not from inside `01/tools/linkup-check`.  
  Capability itself is verified and not blocked by that documentation issue.

## 5. Final Decision

Final status: `PASS`

G1 independently satisfies its acceptance matrix and can be treated as an accepted prerequisite for later stages.

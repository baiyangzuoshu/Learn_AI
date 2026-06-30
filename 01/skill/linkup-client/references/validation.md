# LinkUpClient Validation Reference

## Preflight Command

Always run from the repository root (`/Users/youjunmao/WORK/Learn_AI`):

```bash
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient
```

## Complete and Targeted Commands

### Complete check (all rules)

```bash
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient
```

### Targeted single-rule check

```bash
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient -r <rule-id>
```

### With baseline override (for isolated scenarios)

```bash
node 01/tools/linkup-check/bin/linkup-check.mjs --project <tmp-project> --baseline <tmp>/baseline.json
```

### JSON output

```bash
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient -f json
```

### List all rules

```bash
node 01/tools/linkup-check/bin/linkup-check.mjs --list-rules
```

## Rule IDs and Severity

| Rule ID | Severity | What It Checks |
|---|---|---|
| `prefab/json-valid` | ERROR | Each `.prefab` file is valid JSON, is a JSON array, and contains a `cc.Prefab` entry |
| `ui/prefab-root-name` | ERROR | Prefab filename matches root node name; detects duplicate root names across prefabs |
| `ui/controller-node-paths` | ERROR | Paths in `getChildByUrl`, `AddButtonListener`, `AddDelayButtonListener`, `AddMOUSEListener` exist in the matching prefab; button listeners require `cc.Button` |
| `ui/registration` | ERROR / WARNING | Every `UIName` has a matching prefab; every registered `UIControllerName` has a matching controller. Missing deterministic relationships produce **ERROR**. Local-only UI, orphan prefabs, or relationships that cannot be statically confirmed produce **WARNING**. |
| `component/duplicate-attach` | WARNING | Detects duplicate `addComponent` calls for the same class in the same method |

Dynamic or absolute paths produce `INFO` level — they cannot be statically verified and must be confirmed at runtime.

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | No unbaselined errors found. May contain INFO and BASELINED items. |
| `1` | Rule errors detected that are not in the baseline. |
| `2` | Configuration, path, or tool error (e.g., missing project directory, invalid arguments). |

## Prefab JSON Validation

The `prefab/json-valid` rule checks:
- File is readable.
- Content is valid JSON.
- JSON is an array (Cocos Creator 2.x format).
- Array contains at least one `cc.Prefab` type entry.

Invalid prefab JSON will cause cascading failures in other rules that depend on parsing.

## TypeScript and Build Checking

- Use the project's `tsconfig.json` for syntax validation: `npx tsc --noEmit` (if available in project tooling).
- For isolated fixture TypeScript, basic syntax checking via `node --check` or `tsc --noEmit` is acceptable.
- Cocos Creator is required for full compilation since `cc` namespace is only available in the editor.
- The checker does not perform TypeScript compilation — it parses TypeScript source as text for path extraction.

## Baseline Restrictions

- The real project baseline is stored at `01/tools/linkup-check/linkup-check.baseline.json`.
- Baselined items appear as `BASELINED` in output with their original rule and location.
- **Never modify the baseline** to suppress new diagnostics. New errors must be fixed, not baselined.
- For isolated test scenarios, use an empty baseline `[]` passed via `--baseline` to avoid real-project baseline interference.

## Fixture / Temporary Project Testing

A minimal temporary project for isolated scenarios needs:

```
<tmp>/
├── project.json          # {"engine":"cocos-creator-js","name":"Test","id":"...","version":"2.4.15","isNew":false}
├── baseline.json         # []
├── assets/
│   ├── BundleLLK/GUI/    # Prefab files
│   └── Scripts/
│       ├── UI/           # Controller files
│       ├── Manager/
│       │   └── UIController.ts  # Minimal stub
│       └── Constant.ts   # UIName, UIControllerName entries
```

Note: Do not include `"packages":"packages"` in the project.json. The `packages` directory was deleted from this project and must not be referenced or recreated.

Pass empty baseline: `--baseline <tmp>/baseline.json`

After testing, delete the temporary project directory.

## Completion Report Fields

A G2 implementation report must include:

1. Actual changed-file list.
2. Interface or plan deviations (write "none" if there are none).
3. All commands executed with exit codes.
4. `quick_validate.py` complete result.
5. Scenario-by-scenario evidence (pre-change, modification, post-change).
6. Real-project before/after `git status --short -- 01/LinkUpClient` comparison.
7. Known limitations and skipped checks.
8. Statement that no Cocos runtime or visual verification was performed.
9. Commands an independent acceptance AI can copy and re-run.
10. `git diff --check` result and list of all untracked G2 files.

## Cocos Editor and Device Verification Boundary

The G1 checker performs **static analysis only**. It does not:

- Launch Cocos Creator Editor.
- Run the game on any device or emulator.
- Verify visual layout, animation, or interaction.
- Confirm runtime behavior of dynamic paths.

When static checks pass, state: "静态验证通过". Without Cocos runtime or device testing, state: "未执行运行态/视觉验收".

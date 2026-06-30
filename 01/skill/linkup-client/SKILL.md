---
name: linkup-client
description: "Inspect, modify, and validate LinkUpClient Cocos Creator 2.x game code and GUI prefabs. Use when working with LinkUpClient TypeScript source, GUI prefabs, UI controllers, node paths, buttons, labels, layout, UIName/UIController registration, managers, events, components, resource paths, or project-level static checking and diagnosis."
---

# LinkUpClient Skill

## Fact Source Rule

Rebuild all project knowledge from actual repository files before acting. Priority:

1. Files under `01/LinkUpClient/` — highest authority.
2. G1 checker `01/tools/linkup-check/` — current rule contracts and output format.
3. This skill's references — derived from verified project facts.

Do not depend on or recreate the deleted `packages` directory. The `project.json` field `"packages": "packages"` is legacy and inactive.

## Reference Routing

Read these references when the task requires them:

- **`references/architecture.md`** — Cocos Creator configuration, entry path, manager/component ownership, UIComponent caching, and bundle boundaries. Read before any code change.
- **`references/ui-contracts.md`** — Prefab naming, node hierarchy, button/layout rules, modal patterns, registration flow, and asset locations. Read before creating or modifying a GUI prefab or UI controller.
- **`references/validation.md`** — All `linkup-check` commands, rule IDs, exit codes, baseline restrictions, fixture testing, and completion report format. Read before running checks or writing a report.

## Core Workflow

For every task:

1. Read `references/architecture.md` if unfamiliar with the project structure.
2. Inspect the closest existing implementation and its consumers before editing.
3. Run the pre-change checker:
   ```bash
   node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient
   ```
4. Make the smallest authorized change.
5. Run the post-change checker with the same command.
6. Interpret results using `references/validation.md`.
7. State explicitly: static verification passing does **not** mean runtime or visual success. Without opening Cocos Creator or running on a device, write "未执行运行态/视觉验收".

## UI Change Workflow

When creating or modifying a GUI prefab or UI controller:

1. Read `references/ui-contracts.md`.
2. Ensure root node name, prefab basename, and `UIName` value are identical.
3. Every `getChildByUrl` and button listener path must exist in the prefab hierarchy.
4. Nodes registered with `AddButtonListener` or `AddDelayButtonListener` require a `cc.Button` component.
5. For globally shown views, update `UIName` and `UIControllerName` in `Constant.ts`, then register in `UIController.ts`.
6. For local-only views, show via `UIManager.Instance.IE_ShowUIView(UIName.X)` and immediately `view.addComponent(XUICtrl)`.
7. Preserve `.meta` files. Do not rename or move existing nodes without checking all path references.
8. Run targeted checks after changes:
   ```bash
   node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient -r ui/controller-node-paths
   node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient -r ui/registration
   node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient -r ui/prefab-root-name
   ```

## Non-UI Workflow

When modifying gameplay code, managers, or non-UI logic:

1. Read `references/architecture.md` for module boundaries.
2. Confirm the change does not break UIComponent cache paths or manager singletons.
3. Run the complete checker after changes.
4. Use available TypeScript syntax checking through project-supported tooling.

## Safety Rules

- Never modify `01/LinkUpClient` without explicit user authorization for that specific change.
- Never copy `linkup-check` source into this Skill. Invoke its public interface only.
- Never modify the G1 baseline, G1 acceptance records, or plan documents.
- Never install, replace, delete, or disable the personal `linkup-cocos-ui-prefab` Skill.
- Never create MCP, Runtime, GUI tooling, or Agent orchestration files.
- Do not add README, changelog, or unrelated files.
- Do not commit, push, or open a PR unless explicitly authorized.

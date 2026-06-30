# LinkUpClient G2 Repository Skill Detailed Implementation and Acceptance Plan

> Status: implementation plan only  
> Date: 2026-07-01  
> Stage: G2  
> Depends on: accepted G1 `linkup-check`  
> Implementer: implementation AI  
> Final decision: independent acceptance AI

## 1. Purpose

G2 creates a repository-owned `linkup-client` Skill that teaches an AI how to inspect, modify, and validate LinkUpClient without relying on remembered project structure or the deleted `packages` directory.

The Skill must connect project-specific knowledge to the deterministic G1 checker. It must make an AI follow a repeatable sequence:

1. Rebuild facts from the actual repository.
2. Inspect the closest working implementation and its consumers.
3. Run `linkup-check` before editing.
4. Make the smallest authorized change.
5. Run targeted checks and the complete checker after editing.
6. Distinguish static evidence from Cocos runtime and visual evidence.

G2 does not build MCP, Runtime automation, an Agent loop, or game features.

## 2. Role separation

### Planning AI

- Own this plan and the acceptance criteria.
- Does not implement the Skill.
- Independently checks the implementation after the implementation AI finishes.

### Implementation AI

- Implements only the files allowed by this plan.
- May self-test and write an implementation report.
- Must not declare G2 accepted.

### Independent acceptance AI

- Rebuilds facts from the resulting files.
- Repeats critical commands and isolated scenarios.
- Assigns exactly one result: `PASS`, `PASS WITH NOTES`, `FAIL`, or `BLOCKED`.

## 3. Preconditions

Before writing any G2 file, the implementation AI must verify:

- `01/tools/linkup-check/bin/linkup-check.mjs` exists.
- G1 tests pass.
- A full check of `01/LinkUpClient` exits `0` with the reviewed baseline.
- `01/LinkUpClient` has no implementation-AI changes.
- `01/skill/linkup-client` does not already contain user work.
- The current personal `linkup-cocos-ui-prefab` Skill, if present, is read-only migration input rather than the destination.

If any precondition fails, stop before writing and report the exact blocker.

## 4. Fact sources

Use this priority when sources disagree:

1. Actual files under `01/LinkUpClient`.
2. Current output and public contract of G1 `linkup-check`.
3. `01/docs/linkup-ai-engineering-master-plan.md` and this plan.
4. Existing repository documentation.
5. The personal `linkup-cocos-ui-prefab` Skill, read-only.
6. Memory or historical Inspector notes.

The project has no usable `packages` directory. Do not recreate it, depend on it, or treat the legacy `project.json` field that names it as an active architecture source.

## 5. Scope

### 5.1 Allowed writes

- `01/skill/linkup-client/**`
- `01/docs/acceptance/G2-implementation-report-*.md`

### 5.2 Conditional read-only access

- `01/LinkUpClient/**`
- `01/tools/linkup-check/**`
- `~/.codex/skills/linkup-cocos-ui-prefab/**`
- `~/.codex/skills/.system/skill-creator/**`

### 5.3 Forbidden writes

- `01/LinkUpClient/**`
- `01/tools/linkup-check/**`
- `01/mcp/**`
- `01/agent/**`
- `~/.codex/skills/linkup-cocos-ui-prefab/**`
- Any installed personal Skill location
- G1 baseline or G1 acceptance record
- This plan or the master plan

### 5.4 Forbidden actions

- Do not install, replace, delete, or disable the personal Skill.
- Do not create MCP, Runtime, GUI tooling, or Agent orchestration.
- Do not copy `linkup-check` source into the Skill.
- Do not add README, changelog, installation guide, quick reference, or unrelated assets.
- Do not modify game code to make a scenario pass.
- Do not commit, push, or open a pull request unless the user separately authorizes it.
- Do not use a subagent or forward-test in another thread without explicit user approval.

## 6. Required deliverables

```text
01/skill/linkup-client/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    ├── architecture.md
    ├── ui-contracts.md
    └── validation.md

01/docs/acceptance/
└── G2-implementation-report-YYYYMMDD.md
```

No other G2 files are required. Add a bundled script or asset only after a written deviation request is approved.

## 7. Skill content contract

### 7.1 `SKILL.md`

Requirements:

- Folder and frontmatter name: `linkup-client`.
- Frontmatter contains only `name` and `description`.
- Description explains both capability and triggers.
- Trigger coverage includes:
  - LinkUpClient TypeScript and gameplay code.
  - Managers, events, components, and resource paths.
  - GUI prefab creation and modification.
  - UI controllers, node paths, buttons, labels, and layout.
  - `UIName` and `UIController` registration.
  - Project-level static checking and diagnosis.
- Body remains under 500 lines; target 50–120 lines.
- Body uses imperative workflow instructions rather than repeating reference details.
- Body links directly to all three one-level references and explains when to read each.
- Body requires a pre-change and post-change `linkup-check` run.
- Body explicitly states that static success is not runtime or visual success.
- Body forbids dependence on the deleted `packages` directory.

Recommended body sections:

1. Fact source rule.
2. Reference routing.
3. Core workflow.
4. UI-change workflow.
5. Non-UI workflow.
6. Safety and reporting rules.

Do not add a “When to use” body section; triggering belongs in the frontmatter description.

### 7.2 `agents/openai.yaml`

Generate it with `skill-creator` rather than authoring undocumented fields manually.

Required interface fields:

- `display_name`
- `short_description`, 25–64 characters
- `default_prompt`, one sentence that explicitly contains `$linkup-client`

Quote all string values. Do not add MCP dependencies during G2.

### 7.3 `references/architecture.md`

Rebuild this document from actual code. At minimum cover:

- Cocos Creator and TypeScript configuration.
- Entry path and `UIRoot` initialization.
- Manager/component ownership boundaries.
- `UIManager`, `UIController`, `EventManager`, and `UIComponent` relationships.
- Dynamic `addComponent` conventions.
- Node-path caching behavior.
- Gameplay module boundaries.
- Bundle/resource loading boundaries.
- Generated directories that must not be edited as source.
- The explicit rule that `packages` is not an active dependency.

Do not turn the reference into a complete source-code walkthrough.

### 7.4 `references/ui-contracts.md`

Rebuild and selectively migrate verified rules. At minimum cover:

- `750 × 1334` portrait baseline.
- Root name, prefab basename, `UIName`, and controller naming relationship.
- Central versus local UI registration.
- Dynamic controller attachment after `IE_ShowUIView`.
- Node hierarchy and path names as code API.
- Button component requirements.
- Dynamic path handling and runtime confirmation.
- Established grouping patterns such as `top`, `bottom`, `bg`, `bg2`, `mask`, and `touch`.
- Modal blockers and `cc.BlockInputEvents`.
- Reusable art, font, effect, and label locations verified from the project.
- Cocos Creator 2.x prefab JSON and `.meta` preservation.
- Historical exceptions: do not normalize unrelated baselined issues.

Avoid presenting common dimensions or node names as universal requirements unless actual code proves the contract.

### 7.5 `references/validation.md`

At minimum cover:

- Repository-root preflight command.
- Complete and targeted `linkup-check` commands.
- All five rule IDs and their severity meaning.
- Exit codes `0`, `1`, and `2`.
- Prefab JSON validation.
- TypeScript/build checking only through available project-supported tooling.
- Exact baseline restrictions and prohibition on automatic suppression.
- Temporary/fixture testing guidance.
- Required completion report fields.
- Cocos Editor and device/runtime verification boundary.

## 8. Implementation procedure

### G2-P0: preflight and scope lock

Actions:

1. Print the stage, objective, allowed paths, forbidden paths, dependencies, commands, and risks.
2. Run `git status --short`.
3. Run G1 tests.
4. Run the complete checker against `01/LinkUpClient`.
5. Record a hash or exact copy of `git status --short -- 01/LinkUpClient` for final comparison.

Exit criteria:

- G1 is usable.
- No LinkUpClient write is required.
- No user-owned Skill files would be overwritten.

### G2-P1: fact extraction

Read only the files needed to establish the contracts, including:

- `project.json` and `tsconfig.json`.
- `assets/Scripts/LinkUp.ts`.
- `assets/FrameWork/ui/UIComponent.ts`.
- `assets/FrameWork/manager/UIManager.ts` and `EventManager.ts`.
- `assets/Scripts/UI/UIRootUICtrl.ts`.
- `assets/Scripts/Manager/UIController.ts`.
- `assets/Scripts/Constant.ts`.
- Representative full-screen, popup, toast, and reward prefabs/controllers.
- The G1 rule contracts and current diagnostics.

Optionally read the personal `linkup-cocos-ui-prefab` Skill. Verify every migrated claim against current project files.

Exit criteria:

- Every project-specific claim planned for the Skill has a current source.
- No statement depends on `packages` or stale Inspector documentation.

### G2-P2: initialize the Skill

The implementation AI must first read the complete `skill-creator/SKILL.md` and its `references/openai_yaml.md`.

Use `init_skill.py` with:

- Skill name `linkup-client`.
- Output parent `01/skill`.
- Resource directory `references` only.
- Explicit `display_name`, `short_description`, and `default_prompt` interface values.

Do not use `--examples`; do not retain placeholder files.

Exit criteria:

- The required directory skeleton exists.
- No file outside the allowed path was created.

### G2-P3: author the Skill and references

Actions:

1. Replace every TODO and placeholder.
2. Keep process instructions in `SKILL.md`.
3. Put project facts in the three reference files.
4. Avoid copying the same rule into multiple files.
5. Make the checker command stable from the repository root.
6. State the runtime/visual boundary in both workflow and validation reference.

Exit criteria:

- All required content contracts in section 7 are satisfied.
- `SKILL.md` remains below 500 lines.
- No unrelated documentation exists.

### G2-P4: regenerate UI metadata

Run `generate_openai_yaml.py` after the final `SKILL.md` wording is stable.

Exit criteria:

- `agents/openai.yaml` is consistent with `SKILL.md`.
- `default_prompt` explicitly invokes `$linkup-client`.
- No G3 MCP dependency is declared.

### G2-P5: structural validation

Run:

```bash
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  01/skill/linkup-client
```

Also verify:

- Exact file tree.
- No TODO or placeholder text.
- No README or extra guide.
- Frontmatter keys are exactly `name` and `description`.
- Reference links resolve.
- `SKILL.md` line count is below 500.
- All three references are one level below the Skill.

Exit criteria:

- Validator exits `0`.
- All manual structure checks pass.

### G2-P6: isolated workflow scenarios

Execute all three scenarios in section 9. Use fixtures or temporary projects outside `01/LinkUpClient`.

Requirements for every scenario:

1. Record the pre-change check.
2. Make a minimal isolated change.
3. Parse changed prefab JSON where applicable.
4. Perform an available syntax check for fixture TypeScript.
5. Run targeted `linkup-check` when useful.
6. Run the complete checker after the change.
7. Explain warnings and dynamic `info` results.
8. Explicitly state that no Cocos visual evidence was produced.
9. Delete temporary artifacts after recording results.

Exit criteria:

- All scenarios produce reproducible command evidence.
- A deliberately broken case fails before repair and passes after repair.
- The real project remains unchanged.

### G2-P7: final self-test package

Actions:

1. Run `quick_validate.py` again.
2. Run the complete G1 check against the real project again.
3. Compare `git status --short -- 01/LinkUpClient` with the preflight snapshot.
4. Run `git diff --check` and explicitly account for untracked G2 files.
5. Write `G2-implementation-report-YYYYMMDD.md`.

The implementation report must contain:

- Actual changed-file list.
- Interface or plan deviations; write “none” when there are none.
- Commands and exit codes.
- Validator result.
- Scenario-by-scenario evidence.
- Real-project before/after status.
- Known limitations and skipped runtime checks.
- Commands an independent acceptance AI can copy.
- The statement that implementation AI does not self-accept G2.

Exit criteria:

- The submission package is complete.
- No forbidden path changed.
- G2 is ready for independent acceptance.

## 9. Required isolated scenarios

### Scenario A: modify an existing popup button or text node

Use a fixture or temporary project containing a valid popup prefab and controller.

Minimum flow:

1. Confirm the initial node-path rule passes.
2. Add or rename one button/text node and update the matching controller path.
3. Preserve the button component when the path is used by a listener.
4. Parse the prefab JSON.
5. Run `ui/controller-node-paths` and the complete checker.

Expected result:

- No new path or button error.
- A local-only registration warning is acceptable only when the scenario explicitly models a local view and the report explains it.
- No visual claim is made.

### Scenario B: add and register a small global popup

Use a minimal temporary LinkUpClient-shaped project.

Minimum flow:

1. Record an empty or known-good preflight.
2. Add a prefab with aligned basename and root name.
3. Add a controller with one valid button path.
4. Add `UIName` and `UIControllerName` entries.
5. Add the `UIController` listener and handler.
6. Call `IE_ShowUIView(UIName.X)` and dynamically attach the controller.
7. Parse JSON, check fixture syntax, and run all five rules.

Expected result:

- Complete checker exits `0` with no registration, path, or root-name diagnostic.
- The scenario does not touch the real game.

### Scenario C: diagnose and repair a node-path or duplicate-attach issue

Construct one deterministic issue.

Preferred node-path flow:

1. Controller references a missing literal path.
2. Targeted checker exits `1` with `ui/controller-node-paths` and a useful location.
3. Repair only the path or matching prefab node.
4. Targeted checker exits `0` after repair.
5. Complete checker exits `0` apart from explicitly explained non-error fixture warnings.

An equivalent duplicate-attach scenario is allowed if it proves the warning before repair and its removal afterward.

## 10. Temporary scenario project contract

A minimal temporary project should contain:

```text
<tmp>/project.json
<tmp>/assets/BundleLLK/GUI/
<tmp>/assets/Scripts/UI/
<tmp>/assets/Scripts/Manager/UIController.ts
<tmp>/assets/Scripts/Constant.ts
```

Use an explicit empty baseline file for isolated scenarios so the real-project baseline cannot affect fixture results:

```json
[]
```

Pass it with `--baseline <tmp>/baseline.json`.

The temporary harness itself is test infrastructure. Do not retain it inside the Skill unless the user approves a plan deviation.

## 11. Independent acceptance matrix

| ID | Acceptance item | Independent method | Pass condition |
|---|---|---|---|
| G2-01 | Directory structure | Enumerate actual files | Only required Skill files and implementation report exist |
| G2-02 | Frontmatter | Run quick validator and parse YAML header | Only `name` and `description`; name is `linkup-client` |
| G2-03 | Trigger description | Review metadata | Covers code, GUI, registration, assets, and checks without relying on body text |
| G2-04 | Progressive disclosure | Read SKILL and references | Core workflow is concise; details live in three one-level references without duplication |
| G2-05 | Tool integration | Execute scenario and inspect workflow | Pre/post `linkup-check` is mandatory; no checker source copied |
| G2-06 | Fact priority | Test deleted-`packages`/stale-doc case | Skill inspects actual directories and explicitly rejects `packages` dependency |
| G2-07 | Runtime boundary | Review UI scenario report | Static result is not described as runtime or visual success |
| G2-08 | Existing popup scenario | Reproduce Scenario A | Path/button contract remains valid; evidence complete |
| G2-09 | New popup scenario | Reproduce Scenario B | Naming, registration, dynamic attachment, JSON, and checker all pass |
| G2-10 | Diagnosis scenario | Reproduce Scenario C | Broken case is detected and minimal repair clears it |
| G2-11 | Metadata consistency | Inspect `agents/openai.yaml` | UI fields match Skill and default prompt contains `$linkup-client` |
| G2-12 | Real project read-only | Compare status before/after | `01/LinkUpClient` has no G2 changes |
| G2-13 | Personal Skill isolation | Inspect personal Skill and worktree | Existing personal Skill was not changed or overwritten |
| G2-14 | Final package | Inspect report and rerun commands | Commands, results, deviations, limitations, and handoff are reproducible |

## 12. Automatic failure conditions

Assign `FAIL` when any of these occurs:

- Any write under `01/LinkUpClient`, G1 tools, MCP, Agent, or the personal Skill.
- A `packages` dependency is introduced or treated as current truth.
- Frontmatter has extra keys or invalid naming.
- `SKILL.md` omits the mandatory checker workflow.
- The Skill copies checker implementation instead of invoking its public interface.
- Missing `agents/openai.yaml` or any of the three references.
- `quick_validate.py` fails.
- Fewer than three isolated scenarios have reproducible evidence.
- New-popup registration or path checks are falsely reported as passing.
- Runtime or visual success is claimed without observed Cocos/runtime evidence.
- New diagnostics are hidden by changing the G1 baseline.
- Implementation AI declares its own final acceptance.

Use `BLOCKED` only when a required command cannot be executed because of an external condition and no safe isolated alternative exists.

## 13. Non-blocking notes

These can produce `PASS WITH NOTES` only when all mandatory conditions pass:

- Wording or organization can be shortened without changing behavior.
- A local-only fixture produces an accurately explained registration warning.
- Runtime/visual checks are not performed and are correctly reported as not performed.
- Installation into the personal Skill directory is deferred, as required by this stage.

## 14. G2 completion boundary

G2 ends when the repository Skill passes independent acceptance. It does not install or activate the Skill globally and does not start G3 automatically.

After `PASS` or `PASS WITH NOTES`, the planning/acceptance AI may authorize the separate G3 MCP implementation plan.


# Token Efficiency Benchmark

## Scope and method

This is a deterministic harness benchmark, not a live-provider performance claim. The fixed task set
below is represented by the production runtime tests and fake providers. Fake responses do not stand
in for provider usage, cache billing, or network latency. Those fields are reported as unknown
unless a real provider returns them.

For the initial short-question request, the baseline is reconstructed with all registered tool
schemas and prompt sections visible. The optimized request uses the production core/security tool
set and its optional-capability directory. Both use the same workspace, question, token estimator,
message serialization, and current production definitions. This is a counterfactual first-request
comparison; it does not estimate later compaction or cache effects.

The estimator is `conservative-v1` (serialized characters), not a provider tokenizer. Therefore the
percentage below applies only to estimated input for this request, not to billed tokens or total
task cost.

## Fixed task set and observed results

| Task                                        | Input tokens: baseline → optimized   | Output/cache/cost                         | API, summary, and extra-read observations                                                                                                                             | Completion and constraint evidence                                                                                                            | Duration                                                   |
| ------------------------------------------- | ------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Short question: “What does the project do?” | 23,213 → 5,062 estimated (78% lower) | Provider output, cache, and cost: unknown | 1 request in either path; no summary or extra read                                                                                                                    | Fake provider path is a single final answer                                                                                                   | Live duration: unknown                                     |
| Multi-file retrieval                        | Unknown                              | Unknown                                   | 3 requests in the fixed fixture (two file reads + answer), 0 summaries, 0 extra capability loads                                                                      | Both file results reach the answer and workspace/no-network constraints are retained                                                          | Unknown                                                    |
| Long build log                              | Unknown                              | Unknown                                   | Fixed 500-line fixture uses 3 provider requests: run build, fetch one targeted 3-line page, answer. Supplemental reads: 1; the test rejects unexpected extra requests | Lines 220–222 are restored from the archive without rereading the whole log                                                                   | Unknown                                                    |
| Multi-round modifications                   | Unknown                              | Unknown                                   | 4 provider requests across 3 tool rounds; 0 summary requests; ordinary compaction adds no provider call                                                               | Tool-call/result pairs remain matched across rounds                                                                                           | Fake-provider duration is not comparable to real execution |
| Long conversation continuation              | Unknown                              | Unknown                                   | First overflow run: 1 rejected request + 1 summary + 1 recovery request. Resuming from the saved checkpoint: 1 answer request and 0 repeated summary calls            | Checkpoint test verifies the covered prefix is omitted on resume; summary test checks constraints, completed work, evidence, and pending work | Unknown                                                    |
| Cancellation and context overflow           | Unknown                              | Unknown                                   | Cancellation: 1 request, no retry or summary. Overflow: at most 1 recovery; the summary recovery fixture makes 3 provider calls total                                 | Cancellation terminates; a second explicit overflow propagates instead of retrying                                                            | Unknown                                                    |

Only the short-question input comparison has a measured savings percentage. It compares serialized
request estimates, not API `usage`. For the other tasks, token totals and savings percentages remain
unknown because the fake provider does not supply real usage and no matching pre-optimization
transcript was recorded.

## Capability and read-back tradeoffs

- The initial production request carries 10 of 62 registered tool schemas. Core multi-file reads
  keep the same 3-request sequence and need no capability load. A task needing one optional tool
  group can add one request (load group, use tool, answer); that cost must be weighed against
  smaller schemas on every request. The capability test also intentionally exercises an invalid
  hidden-tool call as a separate safety case, so its 4-call count is not a workload result.
- The long-log fixture asks for one range and receives one page in one supplemental read; it does
  not yet measure page counts under a live model. Track `read_tool_result` calls per task in a live
  run before deciding whether preview size or page size needs adjustment.
- Provider cache hit/miss usage is displayed separately from estimated context reduction. Cache hits
  and monetary savings are unknown for this fake-provider suite.

## Reproduction

Run the fixed fake-provider acceptance suite:

```sh
cd typescript
deno task test
```

Relevant cases are `capability_loading_test.ts`, `tool_result_store_test.ts`,
`layered_context_compaction_test.ts`, `structured_context_summary_test.ts`, and
`context_checkpoint_test.ts`. The short-question comparison can be reproduced with
`estimateRequestInputTokens` using the same user message, all versus visible tool definitions, and
the corresponding full versus core/security prompt plus optional-capability directory.

To report task-wide savings, run this same task set through a real provider before and after the
baseline revision and export each trace's `tokenUsage`. Leave missing provider usage, cache values,
and cost as `unknown`; record wall-clock duration separately from fake-provider test timings.

import type { HarnessFeature } from "../contracts.ts";

export const runtimeLimits: HarnessFeature = {
  id: "runtime-limits",
  register({ prompts }) {
    prompts.register({
      id: "runtime-budget",
      title: "Executable runtime budgets",
      priority: 5,
      content:
        "Every run has executable iteration, tool-call, output, cost, and cancellation budgets. Treat budget errors as terminal runtime states; do not retry by silently bypassing a limit. Nested agents must use smaller child budgets.",
    });
  },
};

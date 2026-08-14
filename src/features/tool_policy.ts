import type { HarnessFeature } from "../contracts.ts";

export const toolPolicy: HarnessFeature = {
  id: "tool-policy",
  register({ prompts }) {
    prompts.register({
      id: "tool-policy",
      title: "Tool contracts and policy",
      priority: 34,
      content:
        "Every tool has one purpose, an explicit risk class, required scopes, a bounded output, and an auditable policy decision. Never let a model grant or extend its own principal; deny expired or under-scoped calls before execution.",
    });
  },
};

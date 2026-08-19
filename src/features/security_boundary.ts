import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import { checkSecurityBoundary, readSecurityAudit } from "../security_boundary.ts";

function definition(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ToolDefinition {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

export const securityBoundary: HarnessFeature = {
  id: "security-boundary",
  register({ tools, prompts }) {
    tools.register(
      definition(
        "security_boundary",
        "Check expiring identity, tenant scope, safe HTTPS egress, SSRF controls, and redact secrets",
        {
          scope: { type: "string" },
          url: { type: "string" },
          tenant: { type: "string" },
          text: { type: "string" },
        },
        ["scope", "url"],
      ),
      async (input, context) => {
        if (!context.principal) throw new Error("security boundary requires an identity principal");
        const result = await checkSecurityBoundary(
          context.workspace,
          {
            scope: String(input.scope ?? ""),
            url: String(input.url ?? ""),
            tenant: typeof input.tenant === "string" ? input.tenant : undefined,
            text: typeof input.text === "string" ? input.text : undefined,
          },
          context.principal,
          context.signal,
        );
        return JSON.stringify({ security: result.audit, redactedText: result.redactedText });
      },
      { risk: "external", scopes: ["external"], maxOutput: 20_000 },
    );
    tools.register(
      definition("security_audit", "Read recent security allow and deny decisions", {
        limit: { type: "integer", minimum: 1, maximum: 50 },
      }, []),
      async (input, context) =>
        JSON.stringify({
          audit: await readSecurityAudit(
            context.workspace,
            typeof input.limit === "number" ? input.limit : 50,
          ),
        }),
    );
    prompts.register({
      id: "security-boundary",
      title: "Identity, sandbox, egress, and DLP",
      priority: 42,
      content:
        "Treat identity as short-lived and least-privileged: require the needed scope and matching tenant before an external action. Keep paths inside the active workspace, allow only HTTPS or localhost HTTP, reject credentials and private SSRF destinations, and redact API keys, bearer tokens, passwords, and secrets before returning or logging text. Every allow and deny decision must be auditable; denial is safer than silently widening policy.",
    });
  },
};

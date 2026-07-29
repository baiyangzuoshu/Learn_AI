import type { PromptRegistryContract, PromptSection } from "./contracts.ts";

export class PromptRegistry implements PromptRegistryContract {
  #sections = new Map<string, PromptSection>();
  register(section: PromptSection): void {
    if (!section.id.trim() || !section.content.trim()) throw new Error("Invalid prompt section");
    this.#sections.set(section.id, { ...section, content: section.content.trim() });
  }
  build(workspace: string): { prompt: string; sections: PromptSection[] } {
    const core: PromptSection = {
      id: "core",
      title: "Identity and workspace",
      priority: 0,
      content:
        `You are Deno Agent, a local coding harness working in ${workspace}. Continue until the user's scoped task is complete. Verify outcomes and respect permission boundaries.`,
    };
    const sections = [core, ...this.#sections.values()].sort((a, b) =>
      a.priority - b.priority || a.id.localeCompare(b.id)
    );
    return {
      sections,
      prompt: sections.map((section) => `## ${section.title}\n${section.content}`).join("\n\n"),
    };
  }
}

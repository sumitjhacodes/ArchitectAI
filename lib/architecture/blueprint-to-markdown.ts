import type { ArchitectureBlueprint } from "./schema";

/** Render blueprint as markdown for the Docs panel. */
export function blueprintToMarkdown(blueprint: ArchitectureBlueprint): string {
  const lines: string[] = [];

  lines.push(`# ${blueprint.projectName}`);
  lines.push("");
  lines.push(blueprint.summary);
  lines.push("");
  lines.push("## Tech stack");
  lines.push("");
  for (const item of blueprint.techStack) {
    lines.push(`- **${item.name}** (${item.category}) — ${item.role}`);
  }
  lines.push("");

  for (const chapter of blueprint.chapters) {
    lines.push(`## ${chapter.title}`);
    lines.push("");
    lines.push(`**Goal:** ${chapter.goal}`);
    lines.push("");
    lines.push(`**Diagram:** ${chapter.diagram.type}`);
    lines.push("");
    for (const step of chapter.steps) {
      lines.push(`### ${step.n}. ${step.title}`);
      lines.push("");
      lines.push(step.detail);
      lines.push("");
      if (step.commands?.length) {
        for (const cmd of step.commands) {
          lines.push("```");
          lines.push(cmd);
          lines.push("```");
          lines.push("");
        }
      }
    }
  }

  return lines.join("\n");
}

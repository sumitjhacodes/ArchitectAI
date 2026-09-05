import type { ArchitectureBlueprint } from "./schema";

/** Render blueprint as markdown for the Docs panel. */
export function blueprintToMarkdown(blueprint: ArchitectureBlueprint): string {
  const lines: string[] = [];

  lines.push(`# ${blueprint.projectName}`);
  lines.push("");
  lines.push(blueprint.summary);
  lines.push("");

  lines.push("## Assumptions");
  lines.push("");
  for (const item of blueprint.assumptions ?? []) {
    lines.push(`- ${item}`);
  }
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

  if (blueprint.tradeOffs?.length) {
    lines.push("## Trade-offs");
    lines.push("");
    for (const t of blueprint.tradeOffs) {
      lines.push(`### ${t.decision}`);
      lines.push("");
      lines.push(`- **Alternatives:** ${t.alternatives.join("; ")}`);
      lines.push(`- **Pros:** ${t.pros.join("; ")}`);
      lines.push(`- **Cons:** ${t.cons.join("; ")}`);
      lines.push(`- **Mitigation:** ${t.riskMitigation}`);
      lines.push("");
    }
  }

  if (blueprint.risks?.length) {
    lines.push("## Risks");
    lines.push("");
    for (const r of blueprint.risks) {
      lines.push(
        `- **${r.risk}** (${r.severity} severity / ${r.probability} probability) — ${r.mitigation}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

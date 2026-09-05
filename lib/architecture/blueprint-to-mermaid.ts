import type {
  ArchitectureBlueprint,
  BlueprintChapter,
} from "@/lib/architecture/schema";

function sanitizeId(id: string) {
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, "_");
  return cleaned.match(/^[a-zA-Z]/) ? cleaned : `n_${cleaned}`;
}

function sanitizeLabel(label: string) {
  return label.replace(/"/g, "'").slice(0, 40);
}

/** Convert a chapter diagram graph into Mermaid flowchart / sequence syntax. */
export function chapterToMermaid(chapter: BlueprintChapter): string {
  const { diagram } = chapter;
  const nodes = diagram.nodes ?? [];
  const edges = diagram.edges ?? [];

  if (!nodes.length) {
    return `flowchart LR\n  empty["No diagram"]`;
  }

  if (diagram.type === "sequence") {
    const lines = ["sequenceDiagram"];
    const seen = new Set<string>();
    for (const node of nodes) {
      const id = sanitizeId(node.id);
      if (seen.has(id)) continue;
      seen.add(id);
      lines.push(`  participant ${id} as ${sanitizeLabel(node.label)}`);
    }
    for (const edge of edges) {
      const from = sanitizeId(edge.from);
      const to = sanitizeId(edge.to);
      const label = sanitizeLabel(edge.label || "call");
      lines.push(`  ${from}->>${to}: ${label}`);
    }
    return lines.join("\n");
  }

  const lines = [`flowchart LR`, `  %% ${sanitizeLabel(chapter.title)}`];
  for (const node of nodes) {
    const id = sanitizeId(node.id);
    const label = sanitizeLabel(node.label);
    const shape =
      node.kind === "db" || node.kind === "storage"
        ? `${id}[(${label})]`
        : node.kind === "client"
          ? `${id}([${label}])`
          : `${id}[${label}]`;
    lines.push(`  ${shape}`);
  }
  for (const edge of edges) {
    const from = sanitizeId(edge.from);
    const to = sanitizeId(edge.to);
    if (edge.label?.trim()) {
      lines.push(`  ${from} -->|"${sanitizeLabel(edge.label)}"| ${to}`);
    } else {
      lines.push(`  ${from} --> ${to}`);
    }
  }
  return lines.join("\n");
}

/** End-to-end system flow from the first system/flow chapter (or all chapters merged lightly). */
export function blueprintToSystemMermaid(
  blueprint: ArchitectureBlueprint,
): string {
  const preferred =
    blueprint.chapters.find((c) => c.diagram.type === "system") ||
    blueprint.chapters.find((c) => c.diagram.type === "flow") ||
    blueprint.chapters[0];

  if (!preferred) {
    return `flowchart LR\n  empty["No architecture yet"]`;
  }

  return chapterToMermaid(preferred);
}

export type MermaidBlock = {
  id: string;
  title: string;
  code: string;
};

export function blueprintToMermaidBlocks(
  blueprint: ArchitectureBlueprint,
): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  const seen = new Set<string>();

  const push = (id: string, title: string, code: string) => {
    if (!code.trim() || seen.has(code)) return;
    seen.add(code);
    blocks.push({ id, title, code });
  };

  if (blueprint.chapters.length) {
    push("system-flow", "System / primary flow", blueprintToSystemMermaid(blueprint));
  }

  for (const chapter of blueprint.chapters) {
    if (!chapter.diagram?.nodes?.length) continue;
    push(chapter.id, chapter.title, chapterToMermaid(chapter));
  }

  return blocks;
}

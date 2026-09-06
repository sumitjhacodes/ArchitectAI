import type {
  ArchitectureBlueprint,
  BlueprintChapter,
} from "@/lib/architecture/schema";

/** Mermaid keywords that break flowcharts / sequence diagrams as bare IDs. */
const RESERVED_IDS = new Set([
  "end",
  "subgraph",
  "graph",
  "flowchart",
  "sequenceDiagram",
  "participant",
  "actor",
  "style",
  "class",
  "classDef",
  "click",
  "call",
  "href",
  "linkStyle",
  "default",
  "direction",
  "TB",
  "BT",
  "LR",
  "RL",
  "TD",
]);

function sanitizeId(id: string): string {
  let cleaned = id.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_");
  if (!cleaned || !/^[a-zA-Z]/.test(cleaned)) {
    cleaned = `n_${cleaned || "node"}`;
  }
  // Avoid IDs that start with o/x (circle/cross edge syntax) when single-letter-ish
  if (/^[oxOX]_/.test(cleaned) || cleaned === "o" || cleaned === "x") {
    cleaned = `n_${cleaned}`;
  }
  if (RESERVED_IDS.has(cleaned) || RESERVED_IDS.has(cleaned.toLowerCase())) {
    cleaned = `n_${cleaned}`;
  }
  return cleaned.slice(0, 48);
}

/** Labels safe inside Mermaid double quotes. */
function sanitizeLabel(label: string): string {
  return label
    .replace(/[\r\n\t]+/g, " ")
    .replace(/"/g, "'")
    .replace(/[<>]/g, "")
    .replace(/\|/g, "/")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40) || "node";
}

function nodeShape(id: string, label: string, kind: string): string {
  const text = sanitizeLabel(label);
  // Always quote labels — parentheses/brackets in AI text break unquoted shapes.
  if (kind === "db" || kind === "storage") {
    return `${id}[("${text}")]`;
  }
  if (kind === "client") {
    return `${id}(["${text}"])`;
  }
  return `${id}["${text}"]`;
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
    const idMap = new Map<string, string>();
    const participants: string[] = [];
    const seen = new Set<string>();

    const ensureParticipant = (rawId: string, label?: string) => {
      const existing = idMap.get(rawId);
      if (existing) return existing;
      const id = sanitizeId(rawId);
      idMap.set(rawId, id);
      if (!seen.has(id)) {
        seen.add(id);
        participants.push(
          `  participant ${id} as ${sanitizeLabel(label || rawId)}`,
        );
      }
      return id;
    };

    for (const node of nodes) {
      ensureParticipant(node.id, node.label);
    }
    for (const edge of edges) {
      ensureParticipant(edge.from);
      ensureParticipant(edge.to);
    }

    const messages = edges.map((edge) => {
      const from = ensureParticipant(edge.from);
      const to = ensureParticipant(edge.to);
      const label = sanitizeLabel(edge.label || "call").replace(/:/g, " -");
      return `  ${from}->>${to}: ${label}`;
    });

    return ["sequenceDiagram", ...participants, ...messages].join("\n");
  }

  const lines = [`flowchart LR`];
  const known = new Set<string>();
  const idMap = new Map<string, string>();

  for (const node of nodes) {
    const id = sanitizeId(node.id);
    idMap.set(node.id, id);
    if (known.has(id)) continue;
    known.add(id);
    lines.push(`  ${nodeShape(id, node.label || node.id, node.kind || "other")}`);
  }

  for (const edge of edges) {
    const from = idMap.get(edge.from) ?? sanitizeId(edge.from);
    const to = idMap.get(edge.to) ?? sanitizeId(edge.to);

    // Declare any edge endpoints the model referenced without a node
    if (!known.has(from)) {
      known.add(from);
      lines.push(`  ${nodeShape(from, edge.from, "other")}`);
    }
    if (!known.has(to)) {
      known.add(to);
      lines.push(`  ${nodeShape(to, edge.to, "other")}`);
    }

    const edgeLabel = edge.label?.trim()
      ? sanitizeLabel(edge.label)
      : "";
    if (edgeLabel) {
      lines.push(`  ${from} -->|"${edgeLabel}"| ${to}`);
    } else {
      lines.push(`  ${from} --> ${to}`);
    }
  }

  return lines.join("\n");
}

/** End-to-end system flow from the first system/flow chapter. */
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
    push(
      "system-flow",
      "System / primary flow",
      blueprintToSystemMermaid(blueprint),
    );
  }

  for (const chapter of blueprint.chapters) {
    if (!chapter.diagram?.nodes?.length) continue;
    push(chapter.id, chapter.title, chapterToMermaid(chapter));
  }

  return blocks;
}

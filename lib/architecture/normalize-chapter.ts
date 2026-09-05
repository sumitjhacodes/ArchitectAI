import type { BlueprintChapter } from "@/lib/architecture/schema";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.trim()) return [value];
    return [];
  }
  return value.map((item) => asString(item)).filter(Boolean);
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return fallback;
}

const DIAGRAM_TYPES = new Set([
  "system",
  "flow",
  "sequence",
  "erd",
  "wireframe",
]);

function asDiagramType(
  value: unknown,
): "system" | "flow" | "sequence" | "erd" | "wireframe" {
  const raw = asString(value, "system").toLowerCase();
  if (DIAGRAM_TYPES.has(raw)) {
    return raw as "system" | "flow" | "sequence" | "erd" | "wireframe";
  }
  if (raw.includes("seq")) return "sequence";
  if (raw.includes("flow") || raw.includes("process")) return "flow";
  if (raw.includes("erd") || raw.includes("data") || raw.includes("schema")) {
    return "erd";
  }
  if (raw.includes("wire") || raw.includes("ui") || raw.includes("screen")) {
    return "wireframe";
  }
  return "system";
}

function unwrapChapter(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  if (o.chapter && typeof o.chapter === "object") {
    return o.chapter as Record<string, unknown>;
  }
  // Already a chapter-shaped object
  if ("steps" in o || "diagram" in o || "title" in o) return o;
  return o;
}

/** Coerce messy model JSON into a schema-safe chapter. */
export function normalizeChapterRaw(
  raw: unknown,
  index = 0,
  fallbackTitle = `Chapter ${index + 1}`,
): BlueprintChapter {
  const src = unwrapChapter(raw);

  const steps = Array.isArray(src.steps)
    ? src.steps
        .map((item, si) => {
          if (!item || typeof item !== "object") {
            if (typeof item === "string" && item.trim()) {
              return {
                n: si + 1,
                title: item.slice(0, 80),
                detail: item,
                commands: [] as string[],
              };
            }
            return null;
          }
          const s = item as Record<string, unknown>;
          const title = asString(s.title || s.name || s.step, `Step ${si + 1}`);
          return {
            n: asNumber(s.n ?? s.number ?? s.order, si + 1),
            title,
            detail: asString(s.detail || s.description || s.body, title),
            commands: asStringArray(s.commands ?? s.command ?? s.cmds),
          };
        })
        .filter(
          (
            s,
          ): s is {
            n: number;
            title: string;
            detail: string;
            commands: string[];
          } => !!s,
        )
    : [];

  const diagramSrc =
    src.diagram && typeof src.diagram === "object"
      ? (src.diagram as Record<string, unknown>)
      : {};

  const nodes = Array.isArray(diagramSrc.nodes)
    ? diagramSrc.nodes
        .map((item, ni) => {
          if (!item || typeof item !== "object") return null;
          const n = item as Record<string, unknown>;
          const id = asString(n.id || n.key, `n${ni + 1}`);
          return {
            id,
            label: asString(n.label || n.name || id, id).slice(0, 18),
            kind: asString(n.kind || n.type, "other"),
            group: asString(n.group || n.layer, "2-app"),
          };
        })
        .filter(
          (
            n,
          ): n is { id: string; label: string; kind: string; group: string } =>
            !!n,
        )
        .slice(0, 7)
    : [];

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = Array.isArray(diagramSrc.edges)
    ? diagramSrc.edges
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const e = item as Record<string, unknown>;
          const from = asString(e.from || e.source || e.src);
          const to = asString(e.to || e.target || e.dst);
          if (!from || !to) return null;
          return {
            from,
            to,
            label: asString(e.label || e.name),
          };
        })
        .filter(
          (e): e is { from: string; to: string; label: string } => !!e,
        )
        // Drop edges that point at missing nodes when we have nodes
        .filter((e) => !nodeIds.size || (nodeIds.has(e.from) && nodeIds.has(e.to)))
    : [];

  const title = asString(src.title, fallbackTitle);
  const safeNodes =
    nodes.length > 0
      ? nodes
      : [
          {
            id: "client",
            label: "Client",
            kind: "client",
            group: "1-client",
          },
          {
            id: "api",
            label: "API",
            kind: "service",
            group: "2-app",
          },
          {
            id: "db",
            label: "Database",
            kind: "db",
            group: "3-data",
          },
        ];

  const safeEdges =
    edges.length > 0
      ? edges
      : [
          { from: "client", to: "api", label: "HTTPS" },
          { from: "api", to: "db", label: "SQL" },
        ].filter(
          (e) =>
            safeNodes.some((n) => n.id === e.from) &&
            safeNodes.some((n) => n.id === e.to),
        );

  const safeSteps =
    steps.length > 0
      ? steps
      : [
          {
            n: 1,
            title: "Clarify scope",
            detail: `Define goals for ${title}.`,
            commands: [] as string[],
          },
          {
            n: 2,
            title: "Sketch components",
            detail: "List the main services and data stores.",
            commands: [] as string[],
          },
          {
            n: 3,
            title: "Validate design",
            detail: "Check auth, data flow, and failure modes.",
            commands: [] as string[],
          },
        ];

  return {
    id: asString(src.id, `chapter-${index + 1}`),
    title,
    goal: asString(src.goal || src.objective || src.summary, title),
    steps: safeSteps,
    diagram: {
      type: asDiagramType(diagramSrc.type),
      nodes: safeNodes,
      edges: safeEdges,
    },
  };
}

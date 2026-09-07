import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ArchitectureBlueprint } from "./schema";
import { NODE_H, NODE_W, layoutBlueprintChapters } from "./layout";

type ElementSkeleton = Parameters<typeof convertToExcalidrawElements>[0];
type SkeletonItem = NonNullable<ElementSkeleton>[number];

const KIND_COLORS: Record<string, { bg: string; stroke: string }> = {
  client: { bg: "#e0f2fe", stroke: "#0369a1" },
  app: { bg: "#ecfdf5", stroke: "#047857" },
  api: { bg: "#fef3c7", stroke: "#b45309" },
  service: { bg: "#f3e8ff", stroke: "#7e22ce" },
  db: { bg: "#ffedd5", stroke: "#c2410c" },
  ai: { bg: "#ccfbf1", stroke: "#0f766e" },
  auth: { bg: "#e0e7ff", stroke: "#4338ca" },
  storage: { bg: "#fce7f3", stroke: "#be185d" },
  queue: { bg: "#f1f5f9", stroke: "#475569" },
  step: { bg: "#fafaf9", stroke: "#44403c" },
  other: { bg: "#f5f5f4", stroke: "#57534e" },
};

function colorsFor(kind: string) {
  return KIND_COLORS[kind.toLowerCase()] ?? KIND_COLORS.other;
}

function slugId(prefix: string, value: string) {
  return `${prefix}-${value}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
}

/**
 * Convert a validated ArchitectureBlueprint into Excalidraw elements
 * (chapter frames, labeled nodes, and arrows).
 */
export function blueprintToExcalidrawElements(
  blueprint: ArchitectureBlueprint,
) {
  const laidOut = layoutBlueprintChapters(blueprint.chapters);
  const skeleton: SkeletonItem[] = [];

  // Title block
  skeleton.push({
    type: "text",
    id: "project-title",
    x: 80,
    y: 24,
    text: `${blueprint.projectName} — Architecture Blueprint`,
    fontSize: 28,
    strokeColor: "#1c1917",
  });

  skeleton.push({
    type: "text",
    id: "project-stack",
    x: 80,
    y: 58,
    text: blueprint.techStack.map((t) => t.name).join(" · "),
    fontSize: 16,
    strokeColor: "#78716c",
  });

  for (const block of laidOut) {
    const childIds: string[] = [];
    const nodeIds = new Map<string, string>();

    for (const node of block.nodes) {
      const elId = slugId(block.chapter.id, node.id);
      nodeIds.set(node.id, elId);
      const colors = colorsFor(node.kind);
      childIds.push(elId);

      skeleton.push({
        type: "rectangle",
        id: elId,
        x: node.x,
        y: node.y,
        width: NODE_W,
        height: NODE_H,
        backgroundColor: colors.bg,
        strokeColor: colors.stroke,
        label: {
          text: node.label,
          fontSize: 14,
          textAlign: "center",
          verticalAlign: "middle",
        },
      });
    }

    for (const [edgeIndex, edge] of block.chapter.diagram.edges.entries()) {
      const fromId = nodeIds.get(edge.from);
      const toId = nodeIds.get(edge.to);
      if (!fromId || !toId) continue;

      const from = block.nodes.find((n) => n.id === edge.from);
      const to = block.nodes.find((n) => n.id === edge.to);
      if (!from || !to) continue;

      skeleton.push({
        type: "arrow",
        id: slugId(block.chapter.id, `edge-${edgeIndex}`),
        x: from.x + NODE_W,
        y: from.y + NODE_H / 2,
        strokeColor: "#57534e",
        start: { id: fromId },
        end: { id: toId },
        label: edge.label ? { text: edge.label, fontSize: 12 } : undefined,
      });
      childIds.push(slugId(block.chapter.id, `edge-${edgeIndex}`));
    }

    const frameId = slugId("frame", block.chapter.id);
    skeleton.push({
      type: "frame",
      id: frameId,
      x: block.frameX,
      y: block.frameY,
      width: block.frameW,
      height: block.frameH,
      name: block.chapter.title,
      children: childIds,
    });
  }

  return convertToExcalidrawElements(skeleton, { regenerateIds: false }).map(
    (el) => ({
      ...el,
      customData: {
        ...((el as { customData?: Record<string, unknown> }).customData ?? {}),
        architectai: true,
      },
    }),
  );
}

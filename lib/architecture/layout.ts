import type { BlueprintChapter } from "./schema";

export const NODE_W = 148;
export const NODE_H = 56;
export const NODE_GAP_X = 110;
export const NODE_GAP_Y = 72;
export const CHAPTER_PAD = 64;
export const CHAPTER_GAP_Y = 160;
export const CHAPTER_ORIGIN_X = 100;
export const CHAPTER_ORIGIN_Y = 120;

export type LaidOutNode = {
  id: string;
  label: string;
  kind: string;
  x: number;
  y: number;
};

export type LaidOutChapter = {
  chapter: BlueprintChapter;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  nodes: LaidOutNode[];
};

const KIND_RANK: Record<string, number> = {
  client: 0,
  app: 2,
  api: 3,
  auth: 3,
  service: 4,
  ai: 4,
  queue: 4,
  storage: 5,
  db: 5,
  step: 2,
  other: 3,
};

function layerRank(node: { kind: string; group?: string }): number {
  const fromGroup = node.group?.match(/^(\d+)/);
  if (fromGroup) return Number(fromGroup[1]);
  return KIND_RANK[node.kind.toLowerCase()] ?? 3;
}

function shortLabel(label: string) {
  const t = label.trim();
  return t.length > 18 ? `${t.slice(0, 16)}…` : t;
}

/**
 * Strict column layout: one column per rank, generous gaps, no overlapping boxes.
 */
function layoutNodesLayered(
  nodes: BlueprintChapter["diagram"]["nodes"],
  edges: BlueprintChapter["diagram"]["edges"],
  originX: number,
  originY: number,
): { nodes: LaidOutNode[]; width: number; height: number } {
  const unique = new Map<string, (typeof nodes)[number]>();
  for (const node of nodes) {
    if (!unique.has(node.id)) unique.set(node.id, node);
  }
  const list = [...unique.values()].slice(0, 7);

  const ranks = new Map<string, number>();
  for (const node of list) {
    ranks.set(node.id, layerRank(node));
  }

  for (let pass = 0; pass < 4; pass++) {
    for (const edge of edges) {
      const from = ranks.get(edge.from);
      const to = ranks.get(edge.to);
      if (from === undefined || to === undefined) continue;
      if (to <= from) ranks.set(edge.to, from + 1);
    }
  }

  // Cap column crowding: if >2 nodes share a rank, spread extras to next ranks
  const byRank = new Map<number, typeof list>();
  const sortedById = [...list].sort((a, b) => a.id.localeCompare(b.id));
  for (const node of sortedById) {
    let rank = ranks.get(node.id) ?? 0;
    while ((byRank.get(rank)?.length ?? 0) >= 2) rank += 1;
    ranks.set(node.id, rank);
    const bucket = byRank.get(rank) ?? [];
    bucket.push(node);
    byRank.set(rank, bucket);
  }

  const sortedRanks = [...byRank.keys()].sort((a, b) => a - b);
  const laid: LaidOutNode[] = [];
  let maxRows = 1;

  sortedRanks.forEach((rank, colIndex) => {
    const colNodes = byRank.get(rank) ?? [];
    maxRows = Math.max(maxRows, colNodes.length);
    colNodes.forEach((node, rowIndex) => {
      laid.push({
        id: node.id,
        label: shortLabel(node.label),
        kind: node.kind,
        x: originX + colIndex * (NODE_W + NODE_GAP_X),
        y: originY + rowIndex * (NODE_H + NODE_GAP_Y),
      });
    });
  });

  const width =
    Math.max(1, sortedRanks.length) * NODE_W +
    Math.max(0, sortedRanks.length - 1) * NODE_GAP_X;
  const height = maxRows * NODE_H + Math.max(0, maxRows - 1) * NODE_GAP_Y;

  return { nodes: laid, width, height };
}

export function layoutBlueprintChapters(
  chapters: BlueprintChapter[],
): LaidOutChapter[] {
  let cursorY = CHAPTER_ORIGIN_Y;
  const result: LaidOutChapter[] = [];

  for (const chapter of chapters) {
    const contentOriginX = CHAPTER_ORIGIN_X + CHAPTER_PAD;
    const contentOriginY = cursorY + CHAPTER_PAD + 48;
    const { nodes, width, height } = layoutNodesLayered(
      chapter.diagram.nodes,
      chapter.diagram.edges,
      contentOriginX,
      contentOriginY,
    );

    const frameW = Math.max(780, width + CHAPTER_PAD * 2);
    const frameH = Math.max(260, height + CHAPTER_PAD * 2 + 48);

    result.push({
      chapter,
      frameX: CHAPTER_ORIGIN_X,
      frameY: cursorY,
      frameW,
      frameH,
      nodes,
    });

    cursorY += frameH + CHAPTER_GAP_Y;
  }

  return result;
}

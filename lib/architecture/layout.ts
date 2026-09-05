import type { BlueprintChapter } from "./schema";

export const NODE_W = 160;
export const NODE_H = 64;
export const NODE_GAP_X = 48;
export const NODE_GAP_Y = 36;
export const CHAPTER_PAD = 48;
export const CHAPTER_GAP_Y = 80;
export const CHAPTER_ORIGIN_X = 80;
export const CHAPTER_ORIGIN_Y = 80;

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

function layoutNodesInGrid(
  nodes: BlueprintChapter["diagram"]["nodes"],
  originX: number,
  originY: number,
): { nodes: LaidOutNode[]; width: number; height: number } {
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(nodes.length))));
  const laid: LaidOutNode[] = nodes.map((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      x: originX + col * (NODE_W + NODE_GAP_X),
      y: originY + row * (NODE_H + NODE_GAP_Y),
    };
  });

  const rows = Math.ceil(nodes.length / cols) || 1;
  const width = cols * NODE_W + (cols - 1) * NODE_GAP_X;
  const height = rows * NODE_H + (rows - 1) * NODE_GAP_Y;

  return { nodes: laid, width, height };
}

/** Stack chapters vertically with room for framed diagrams. */
export function layoutBlueprintChapters(
  chapters: BlueprintChapter[],
): LaidOutChapter[] {
  let cursorY = CHAPTER_ORIGIN_Y;
  const result: LaidOutChapter[] = [];

  for (const chapter of chapters) {
    const contentOriginX = CHAPTER_ORIGIN_X + CHAPTER_PAD;
    const contentOriginY = cursorY + CHAPTER_PAD + 36;
    const { nodes, width, height } = layoutNodesInGrid(
      chapter.diagram.nodes,
      contentOriginX,
      contentOriginY,
    );

    const frameW = Math.max(640, width + CHAPTER_PAD * 2);
    const frameH = Math.max(220, height + CHAPTER_PAD * 2 + 36);

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

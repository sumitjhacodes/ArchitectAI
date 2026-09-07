import type {
  BoardMeta,
  BoardRecord,
  BoardSceneSnapshot,
  ProjectConstraints,
  StoredBoardState,
  WorkspaceIndex,
} from "@/types/board";
import type { AiProvider } from "@/types/board";

const INDEX_KEY = "architectai:workspace:v2";
const boardKey = (id: string) => `architectai:board:v2:${id}`;
const LEGACY_KEY = "architectai:board:v1";
const MAX_MESSAGES = 24;
const MAX_BOARDS = 12;
const MAX_SCENE_ELEMENTS = 280;
const SETTINGS_KEY = "architectai:settings:v1";

/** Fields needed to restore Excalidraw elements — drop renderer bloat. */
const ELEMENT_KEEP = new Set([
  "id",
  "type",
  "x",
  "y",
  "width",
  "height",
  "angle",
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
  "groupIds",
  "frameId",
  "roundness",
  "seed",
  "versionNonce",
  "isDeleted",
  "boundElements",
  "updated",
  "link",
  "locked",
  "text",
  "fontSize",
  "fontFamily",
  "textAlign",
  "verticalAlign",
  "containerId",
  "originalText",
  "autoResize",
  "lineHeight",
  "points",
  "lastCommittedPoint",
  "startBinding",
  "endBinding",
  "startArrowhead",
  "endArrowhead",
  "name",
  "customData",
]);

function newId() {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyBoard(
  name = "Untitled architecture",
  provider: AiProvider = "gemini",
): BoardRecord {
  const now = Date.now();
  return {
    version: 2,
    id: newId(),
    name,
    provider,
    messages: [],
    blueprint: null,
    scene: null,
    docsOpen: true,
    chatOpen: true,
    constraints: {},
    failedChapters: [],
    updatedAt: now,
    createdAt: now,
  };
}

function slimElement(el: unknown): Record<string, unknown> | null {
  if (!el || typeof el !== "object") return null;
  const src = el as Record<string, unknown>;
  if (src.isDeleted === true) return null;
  const out: Record<string, unknown> = {};
  for (const key of ELEMENT_KEEP) {
    if (key in src && src[key] !== undefined) out[key] = src[key];
  }
  if (!out.id || !out.type) return null;
  return out;
}

function slimScene(scene: BoardSceneSnapshot | null): BoardSceneSnapshot | null {
  if (!scene?.elements?.length) return scene;
  const elements = scene.elements
    .map(slimElement)
    .filter((e): e is Record<string, unknown> => !!e)
    .slice(0, MAX_SCENE_ELEMENTS);
  const appState = scene.appState
    ? {
        scrollX: scene.appState.scrollX,
        scrollY: scene.appState.scrollY,
        zoom: scene.appState.zoom,
        viewBackgroundColor: scene.appState.viewBackgroundColor,
      }
    : undefined;
  return { elements, ...(appState ? { appState } : {}) };
}

function compactBoard(board: BoardRecord): BoardRecord {
  return {
    ...board,
    version: 2,
    messages: board.messages.slice(-MAX_MESSAGES).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content.slice(0, 12_000),
      createdAt: m.createdAt,
    })),
    scene: slimScene(board.scene),
  };
}

function isQuotaError(err: unknown) {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22)
  );
}

let reclaiming = false;

function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (!isQuotaError(err) || reclaiming) return false;
    reclaiming = true;
    try {
      reclaimStorage();
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    } finally {
      reclaiming = false;
    }
  }
}

/** Drop heavy board scenes / old boards / legacy keys to free quota. */
function reclaimStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }

  const index = readIndexRaw();
  if (!index) return;

  const sorted = [...index.boards].sort((a, b) => a.updatedAt - b.updatedAt);
  const activeId = index.activeBoardId;

  // 1) Strip scenes from oldest inactive boards
  for (const meta of sorted) {
    if (meta.id === activeId) continue;
    const board = loadBoardRecord(meta.id);
    if (!board?.scene?.elements?.length) continue;
    writeBoardPayload({ ...board, scene: null }, false);
  }

  // 2) Cap board count — delete oldest inactive
  const keep = sorted
    .filter((b) => b.id === activeId)
    .concat(
      sorted.filter((b) => b.id !== activeId).slice(-(MAX_BOARDS - 1)),
    );
  const keepIds = new Set(keep.map((b) => b.id));
  for (const meta of index.boards) {
    if (!keepIds.has(meta.id)) {
      try {
        window.localStorage.removeItem(boardKey(meta.id));
      } catch {
        // ignore
      }
    }
  }
  writeIndexRaw({
    version: 2,
    activeBoardId: activeId,
    boards: keep.slice(0, MAX_BOARDS),
  });

  // 3) Slim active board scene as last resort
  if (activeId) {
    const active = loadBoardRecord(activeId);
    if (active?.scene?.elements && active.scene.elements.length > 80) {
      writeBoardPayload(
        {
          ...active,
          scene: slimScene({
            elements: active.scene.elements.slice(0, 80),
            appState: active.scene.appState,
          }),
          messages: active.messages.slice(-10),
        },
        false,
      );
    }
  }
}

function readIndexRaw(): WorkspaceIndex | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceIndex;
    if (parsed?.version === 2) {
      // Ensure index never carries junk — meta only
      return {
        version: 2,
        activeBoardId: parsed.activeBoardId,
        boards: (parsed.boards ?? [])
          .map((b) => ({
            id: String(b.id),
            name: String(b.name || "Untitled").slice(0, 80),
            updatedAt: Number(b.updatedAt) || Date.now(),
            createdAt: Number(b.createdAt) || Date.now(),
          }))
          .slice(0, MAX_BOARDS * 2),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeIndexRaw(index: WorkspaceIndex): boolean {
  if (typeof window === "undefined") return false;
  const clean: WorkspaceIndex = {
    version: 2,
    activeBoardId: index.activeBoardId,
    boards: index.boards
      .map((b) => ({
        id: b.id,
        name: (b.name || "Untitled").slice(0, 80),
        updatedAt: b.updatedAt,
        createdAt: b.createdAt,
      }))
      .slice(0, MAX_BOARDS),
  };
  return safeSetItem(INDEX_KEY, JSON.stringify(clean));
}

function writeIndex(index: WorkspaceIndex) {
  writeIndexRaw(index);
}

function writeBoardPayload(board: BoardRecord, updateIndex = true) {
  if (typeof window === "undefined") return board;
  const payload = compactBoard({
    ...board,
    updatedAt: Date.now(),
  });
  const ok = safeSetItem(boardKey(payload.id), JSON.stringify(payload));
  if (!ok) {
    // Extreme fallback: blueprint + messages only
    const minimal = compactBoard({
      ...payload,
      scene: null,
      messages: payload.messages.slice(-8),
    });
    safeSetItem(boardKey(minimal.id), JSON.stringify(minimal));
    if (updateIndex) upsertIndexMeta(minimal, false);
    return minimal;
  }
  if (updateIndex) upsertIndexMeta(payload, false);
  return payload;
}

function upsertIndexMeta(board: BoardRecord, makeActive = false) {
  const current = readIndexRaw() ?? {
    version: 2 as const,
    activeBoardId: board.id,
    boards: [] as BoardMeta[],
  };
  const meta: BoardMeta = {
    id: board.id,
    name: (board.name || "Untitled").slice(0, 80),
    updatedAt: board.updatedAt,
    createdAt: board.createdAt,
  };
  const others = current.boards
    .filter((b) => b.id !== board.id)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_BOARDS - 1);
  writeIndex({
    version: 2,
    activeBoardId: makeActive
      ? board.id
      : (current.activeBoardId ?? board.id),
    boards: [meta, ...others],
  });
}

function migrateLegacy(): WorkspaceIndex {
  if (typeof window === "undefined") {
    return { version: 2, activeBoardId: null, boards: [] };
  }

  let board: BoardRecord;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const legacy = JSON.parse(raw) as StoredBoardState;
      board = {
        version: 2,
        id: newId(),
        name: legacy.blueprint?.projectName || "Migrated board",
        provider: legacy.provider || "gemini",
        messages: legacy.messages || [],
        blueprint: legacy.blueprint,
        scene: slimScene(legacy.scene),
        docsOpen: legacy.docsOpen ?? true,
        chatOpen: legacy.chatOpen ?? true,
        constraints: {},
        failedChapters: [],
        updatedAt: legacy.updatedAt || Date.now(),
        createdAt: legacy.updatedAt || Date.now(),
      };
      try {
        window.localStorage.removeItem(LEGACY_KEY);
      } catch {
        // ignore
      }
    } else {
      board = emptyBoard();
    }
  } catch {
    board = emptyBoard();
  }

  const index: WorkspaceIndex = {
    version: 2,
    activeBoardId: board.id,
    boards: [
      {
        id: board.id,
        name: board.name,
        updatedAt: board.updatedAt,
        createdAt: board.createdAt,
      },
    ],
  };
  writeIndex(index);
  writeBoardPayload(board, false);
  return index;
}

function readIndex(): WorkspaceIndex {
  const existing = readIndexRaw();
  if (existing) return existing;
  return migrateLegacy();
}

export function listBoards(): BoardMeta[] {
  return readIndex().boards.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActiveBoardId(): string | null {
  return readIndex().activeBoardId;
}

export function loadBoardRecord(id: string): BoardRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(boardKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as BoardRecord;
  } catch {
    return null;
  }
}

export function loadActiveBoard(): BoardRecord | null {
  const index = readIndex();
  if (!index.activeBoardId) return null;
  const board = loadBoardRecord(index.activeBoardId);
  if (board) return board;
  if (index.boards[0]) {
    const fallback = loadBoardRecord(index.boards[0].id);
    if (fallback) {
      writeIndex({ ...index, activeBoardId: fallback.id });
      return fallback;
    }
  }
  return null;
}

export function saveBoardRecord(board: BoardRecord) {
  if (typeof window === "undefined") return;
  writeBoardPayload(board, true);
}

export function setActiveBoard(id: string) {
  const index = readIndex();
  if (!index.boards.some((b) => b.id === id)) return;
  writeIndex({ ...index, activeBoardId: id });
}

export function createBoard(name?: string, provider: AiProvider = "gemini") {
  const board = emptyBoard(name, provider);
  const current = readIndexRaw() ?? {
    version: 2 as const,
    activeBoardId: null,
    boards: [] as BoardMeta[],
  };
  writeIndex({
    version: 2,
    activeBoardId: board.id,
    boards: [
      {
        id: board.id,
        name: board.name,
        updatedAt: board.updatedAt,
        createdAt: board.createdAt,
      },
      ...current.boards.slice(0, MAX_BOARDS - 1),
    ],
  });
  writeBoardPayload(board, false);
  return board;
}

export function renameBoard(id: string, name: string) {
  const board = loadBoardRecord(id);
  if (!board) return null;
  board.name = name.trim() || board.name;
  saveBoardRecord(board);
  return board;
}

export function duplicateBoard(id: string) {
  const board = loadBoardRecord(id);
  if (!board) return null;
  const copy: BoardRecord = {
    ...structuredClone(board),
    id: newId(),
    name: `${board.name} (copy)`.slice(0, 80),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    scene: slimScene(board.scene),
  };
  const index = readIndex();
  writeIndex({
    ...index,
    activeBoardId: copy.id,
    boards: [
      {
        id: copy.id,
        name: copy.name,
        updatedAt: copy.updatedAt,
        createdAt: copy.createdAt,
      },
      ...index.boards.slice(0, MAX_BOARDS - 1),
    ],
  });
  writeBoardPayload(copy, false);
  return copy;
}

export function deleteBoard(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(boardKey(id));
  } catch {
    // ignore
  }
  const index = readIndex();
  const boards = index.boards.filter((b) => b.id !== id);
  let activeBoardId = index.activeBoardId === id ? null : index.activeBoardId;
  if (!activeBoardId && boards.length) {
    activeBoardId = boards[0].id;
  }
  if (!boards.length) {
    const board = emptyBoard();
    writeIndex({
      version: 2,
      activeBoardId: board.id,
      boards: [
        {
          id: board.id,
          name: board.name,
          updatedAt: board.updatedAt,
          createdAt: board.createdAt,
        },
      ],
    });
    writeBoardPayload(board, false);
    return;
  }
  writeIndex({ version: 2, activeBoardId, boards });
}

export function clearActiveBoardContent() {
  const board = loadActiveBoard();
  if (!board) return null;
  const cleared: BoardRecord = {
    ...board,
    messages: [],
    blueprint: null,
    scene: null,
    failedChapters: [],
    constraints: board.constraints,
    updatedAt: Date.now(),
  };
  saveBoardRecord(cleared);
  return cleared;
}

/** @deprecated — use saveBoardRecord */
export function saveBoardState(
  state: Omit<
    BoardRecord,
    "version" | "updatedAt" | "id" | "name" | "createdAt" | "constraints"
  > & {
    constraints?: ProjectConstraints;
    id?: string;
    name?: string;
    createdAt?: number;
  },
) {
  const active = loadActiveBoard();
  const id = state.id || active?.id || newId();
  const existing = loadBoardRecord(id);
  saveBoardRecord({
    version: 2,
    id,
    name:
      state.name ||
      existing?.name ||
      state.blueprint?.projectName ||
      "Untitled architecture",
    provider: state.provider,
    messages: state.messages,
    blueprint: state.blueprint,
    scene: state.scene,
    docsOpen: state.docsOpen,
    chatOpen: state.chatOpen ?? true,
    constraints: state.constraints ?? existing?.constraints ?? {},
    failedChapters: state.failedChapters ?? existing?.failedChapters ?? [],
    createdAt: state.createdAt || existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  });
}

/** @deprecated */
export function loadBoardState(): BoardRecord | null {
  return loadActiveBoard();
}

/** @deprecated */
export function clearBoardState() {
  clearActiveBoardContent();
}

export type AppSettings = {
  provider: AiProvider;
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return { provider: "gemini" };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as AppSettings;
  } catch {
    // ignore
  }
  return { provider: "gemini" };
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
}

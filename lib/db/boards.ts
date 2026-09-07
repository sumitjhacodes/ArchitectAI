import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { ArchitectureBlueprint } from "@/lib/architecture/schema";

export type DurableBoard = {
  id: string;
  userId: string;
  name: string;
  blueprint: ArchitectureBlueprint | null;
  payload: unknown;
  updatedAt: number;
  createdAt: number;
};

export type GenerationRun = {
  id: string;
  userId: string;
  boardId?: string;
  status: "started" | "completed" | "failed";
  error?: string;
  createdAt: number;
  updatedAt: number;
};

type Store = {
  boards: DurableBoard[];
  runs: GenerationRun[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "boards.json");

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as Store;
  } catch {
    return { boards: [], runs: [] };
  }
}

async function writeStore(store: Store) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function listDurableBoards(userId: string) {
  const store = await readStore();
  return store.boards
    .filter((b) => b.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function upsertDurableBoard(
  board: Omit<DurableBoard, "createdAt" | "updatedAt"> & {
    createdAt?: number;
  },
) {
  const store = await readStore();
  const now = Date.now();
  const idx = store.boards.findIndex((b) => b.id === board.id);
  if (idx >= 0) {
    store.boards[idx] = {
      ...store.boards[idx],
      ...board,
      updatedAt: now,
    };
  } else {
    store.boards.push({
      ...board,
      createdAt: board.createdAt ?? now,
      updatedAt: now,
    });
  }
  await writeStore(store);
  return store.boards.find((b) => b.id === board.id)!;
}

export async function deleteDurableBoard(userId: string, id: string) {
  const store = await readStore();
  store.boards = store.boards.filter(
    (b) => !(b.id === id && b.userId === userId),
  );
  await writeStore(store);
}

export async function createGenerationRun(
  run: Omit<GenerationRun, "createdAt" | "updatedAt">,
) {
  const store = await readStore();
  const now = Date.now();
  const full: GenerationRun = { ...run, createdAt: now, updatedAt: now };
  store.runs.unshift(full);
  store.runs = store.runs.slice(0, 200);
  await writeStore(store);
  return full;
}

export async function updateGenerationRun(
  id: string,
  patch: Partial<Pick<GenerationRun, "status" | "error" | "boardId">>,
) {
  const store = await readStore();
  const idx = store.runs.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  store.runs[idx] = {
    ...store.runs[idx],
    ...patch,
    updatedAt: Date.now(),
  };
  await writeStore(store);
  return store.runs[idx];
}

import type { StoredBoardState } from "@/types/board";

const STORAGE_KEY = "architectai:board:v1";
const MAX_MESSAGES = 40;

export function loadBoardState(): StoredBoardState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBoardState;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveBoardState(state: Omit<StoredBoardState, "version" | "updatedAt">) {
  if (typeof window === "undefined") return;
  const payload: StoredBoardState = {
    version: 1,
    updatedAt: Date.now(),
    ...state,
    messages: state.messages.slice(-MAX_MESSAGES),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded — drop scene appState and retry once
    try {
      const slim: StoredBoardState = {
        ...payload,
        scene: payload.scene
          ? { elements: payload.scene.elements }
          : null,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {
      // ignore
    }
  }
}

export function clearBoardState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

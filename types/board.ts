import type { ArchitectureBlueprint } from "@/lib/architecture/schema";

export type AiProvider = "gemini" | "groq";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

export type BoardSceneSnapshot = {
  elements: unknown[];
  appState?: {
    scrollX?: number;
    scrollY?: number;
    zoom?: { value: number };
    viewBackgroundColor?: string;
  };
};

export type ProjectConstraints = {
  scale?: string;
  timeline?: string;
  preferredTech?: string[];
  avoidTech?: string[];
};

export type BoardMeta = {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
};

export type BoardRecord = {
  version: 2;
  id: string;
  name: string;
  provider: AiProvider;
  messages: ChatMessage[];
  blueprint: ArchitectureBlueprint | null;
  scene: BoardSceneSnapshot | null;
  docsOpen: boolean;
  chatOpen: boolean;
  constraints: ProjectConstraints;
  failedChapters?: string[];
  updatedAt: number;
  createdAt: number;
};

export type WorkspaceIndex = {
  version: 2;
  activeBoardId: string | null;
  boards: BoardMeta[];
};

/** @deprecated v1 single-board shape — migrated on load */
export type StoredBoardState = {
  version: 1;
  provider: AiProvider;
  messages: ChatMessage[];
  blueprint: ArchitectureBlueprint | null;
  scene: BoardSceneSnapshot | null;
  docsOpen: boolean;
  chatOpen?: boolean;
  updatedAt: number;
};

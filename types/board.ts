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
  appState?: Record<string, unknown>;
};

export type StoredBoardState = {
  version: 1;
  provider: AiProvider;
  messages: ChatMessage[];
  blueprint: ArchitectureBlueprint | null;
  scene: BoardSceneSnapshot | null;
  docsOpen: boolean;
  updatedAt: number;
};

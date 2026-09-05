"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { blueprintToExcalidrawElements } from "@/lib/architecture/blueprint-to-excalidraw";
import type {
  ArchitectResponse,
  ArchitectureBlueprint,
} from "@/lib/architecture/schema";
import {
  clearBoardState,
  loadBoardState,
  saveBoardState,
} from "@/lib/storage/board-storage";
import type { AiProvider, ChatMessage } from "@/types/board";
import { ChatSidebar } from "./ChatSidebar";
import { DocsPanel } from "./DocsPanel";
import { WhiteboardCanvas } from "./WhiteboardCanvas";

type SceneElement = {
  id: string;
  [key: string]: unknown;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function BoardShell() {
  const [hydrated, setHydrated] = useState(false);
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [blueprint, setBlueprint] = useState<ArchitectureBlueprint | null>(
    null,
  );
  const [docsOpen, setDocsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneElements, setSceneElements] = useState<readonly SceneElement[]>(
    [],
  );
  const [sceneRevision, setSceneRevision] = useState(0);

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = loadBoardState();
    if (stored) {
      setProvider(stored.provider);
      setMessages(stored.messages);
      setBlueprint(stored.blueprint);
      setDocsOpen(stored.docsOpen);
      if (stored.scene?.elements?.length) {
        setSceneElements(stored.scene.elements as SceneElement[]);
        setSceneRevision((n) => n + 1);
      }
    }
    setHydrated(true);
  }, []);

  const persist = useCallback(
    (partial?: {
      messages?: ChatMessage[];
      blueprint?: ArchitectureBlueprint | null;
      provider?: AiProvider;
      docsOpen?: boolean;
      elements?: readonly SceneElement[];
    }) => {
      if (!hydrated) return;
      saveBoardState({
        provider: partial?.provider ?? provider,
        messages: partial?.messages ?? messages,
        blueprint:
          partial && "blueprint" in partial
            ? (partial.blueprint ?? null)
            : blueprint,
        docsOpen: partial?.docsOpen ?? docsOpen,
        scene: {
          elements: [...(partial?.elements ?? sceneElements)] as unknown[],
        },
      });
    },
    [hydrated, provider, messages, blueprint, docsOpen, sceneElements],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(), 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [hydrated, provider, messages, blueprint, docsOpen, sceneElements, persist]);

  const applyBlueprint = useCallback((next: ArchitectureBlueprint) => {
    const elements = blueprintToExcalidrawElements(next) as SceneElement[];
    setBlueprint(next);
    setSceneElements(elements);
    setSceneRevision((n) => n + 1);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      setError(null);
      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setIsLoading(true);

      try {
        const res = await fetch("/api/architect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            messages: nextMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            blueprint: blueprint ?? undefined,
          }),
        });

        const data = (await res.json()) as ArchitectResponse & {
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error || "Request failed");
        }

        const assistantMessage: ChatMessage = {
          id: newId(),
          role: "assistant",
          content: data.narration,
          createdAt: Date.now(),
        };
        const withAssistant = [...nextMessages, assistantMessage];
        setMessages(withAssistant);
        applyBlueprint(data.blueprint);
        persist({
          messages: withAssistant,
          blueprint: data.blueprint,
          elements: blueprintToExcalidrawElements(
            data.blueprint,
          ) as SceneElement[],
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setError(message);
        const failMessage: ChatMessage = {
          id: newId(),
          role: "assistant",
          content: `Could not generate blueprint: ${message}`,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, failMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, provider, blueprint, applyBlueprint, persist],
  );

  const handleClear = useCallback(() => {
    clearBoardState();
    setMessages([]);
    setBlueprint(null);
    setSceneElements([]);
    setSceneRevision((n) => n + 1);
    setError(null);
    apiRef.current?.resetScene();
  }, []);

  const handleCanvasChange = useCallback((elements: readonly SceneElement[]) => {
    setSceneElements(elements);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--bg)] text-sm text-[var(--muted)]">
        Restoring board…
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--bg)] text-[var(--ink)]">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-4">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm font-semibold tracking-tight">
            ArchitectAI
          </a>
          <span className="hidden text-xs text-[var(--muted)] sm:inline">
            Agentic whiteboard
          </span>
        </div>
        {error && (
          <p className="max-w-md truncate text-xs text-red-700" title={error}>
            {error}
          </p>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[300px] shrink-0 md:flex md:flex-col">
          <ChatSidebar
            messages={messages}
            provider={provider}
            isLoading={isLoading}
            onProviderChange={setProvider}
            onSend={handleSend}
            onClear={handleClear}
          />
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="md:hidden">
            <details className="border-b border-[var(--line)] bg-[var(--panel)]">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                Chat
              </summary>
              <div className="h-64 border-t border-[var(--line)]">
                <ChatSidebar
                  messages={messages}
                  provider={provider}
                  isLoading={isLoading}
                  onProviderChange={setProvider}
                  onSend={handleSend}
                  onClear={handleClear}
                />
              </div>
            </details>
          </div>
          <div className="h-[calc(100%-0px)] min-h-[420px] md:h-full">
            <WhiteboardCanvas
              sceneRevision={sceneRevision}
              elements={sceneElements}
              onApiReady={(api) => {
                apiRef.current = api;
              }}
              onChange={handleCanvasChange}
            />
          </div>
        </div>

        <div className="hidden shrink-0 lg:flex">
          <DocsPanel
            blueprint={blueprint}
            open={docsOpen}
            onToggle={() => setDocsOpen((v) => !v)}
          />
        </div>
      </div>

      <div className="border-t border-[var(--line)] bg-[var(--panel)] lg:hidden">
        <details>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            Docs{blueprint ? ` · ${blueprint.projectName}` : ""}
          </summary>
          <div className="h-64 border-t border-[var(--line)]">
            <DocsPanel
              blueprint={blueprint}
              open
              onToggle={() => undefined}
            />
          </div>
        </details>
      </div>
    </div>
  );
}

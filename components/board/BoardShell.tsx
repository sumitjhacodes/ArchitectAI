"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { blueprintToExcalidrawElements } from "@/lib/architecture/blueprint-to-excalidraw";
import type {
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
  const [chatOpen, setChatOpen] = useState(true);
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
      setChatOpen(stored.chatOpen ?? true);
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
      chatOpen?: boolean;
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
        chatOpen: partial?.chatOpen ?? chatOpen,
        scene: {
          elements: [...(partial?.elements ?? sceneElements)] as unknown[],
        },
      });
    },
    [
      hydrated,
      provider,
      messages,
      blueprint,
      docsOpen,
      chatOpen,
      sceneElements,
    ],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(), 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    hydrated,
    provider,
    messages,
    blueprint,
    docsOpen,
    chatOpen,
    sceneElements,
    persist,
  ]);

  const applyBlueprint = useCallback((next: ArchitectureBlueprint) => {
    const elements = blueprintToExcalidrawElements(next) as SceneElement[];
    setBlueprint(next);
    setSceneElements(elements);
    setSceneRevision((n) => n + 1);
  }, []);

  const applyChaptersProgressively = useCallback(
    ( partial: {
      projectName: string;
      summary: string;
      techStack: ArchitectureBlueprint["techStack"];
      assumptions: string[];
      tradeOffs: ArchitectureBlueprint["tradeOffs"];
      risks: ArchitectureBlueprint["risks"];
      chapters: ArchitectureBlueprint["chapters"];
    }) => {
      const next: ArchitectureBlueprint = {
        projectName: partial.projectName,
        summary: partial.summary,
        techStack: partial.techStack,
        assumptions: partial.assumptions,
        tradeOffs: partial.tradeOffs,
        risks: partial.risks,
        chapters: partial.chapters,
      };
      applyBlueprint(next);
    },
    [applyBlueprint],
  );

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
      const assistantId = newId();
      setMessages([
        ...nextMessages,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
        },
      ]);
      setIsLoading(true);

      // Clear canvas for a fresh draw pass
      setBlueprint(null);
      setSceneElements([]);
      setSceneRevision((n) => n + 1);

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

        if (!res.ok || !res.body) {
          const errBody = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(errBody?.error || "Request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let narration = "";
        let completedBlueprint: ArchitectureBlueprint | null = null;
        const streamedChapters: ArchitectureBlueprint["chapters"] = [];
        let receivedNarrationTokens = false;
        let meta: {
          projectName: string;
          summary: string;
          techStack: ArchitectureBlueprint["techStack"];
          assumptions: string[];
          tradeOffs: ArchitectureBlueprint["tradeOffs"];
          risks: ArchitectureBlueprint["risks"];
        } | null = null;

        const appendNarration = (delta: string) => {
          if (!receivedNarrationTokens) {
            receivedNarrationTokens = true;
            narration = "";
          }
          narration += delta;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: narration } : m,
            ),
          );
        };

        setDocsOpen(true);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!line) continue;
            const payload = JSON.parse(line.slice(6)) as {
              type: string;
              delta?: string;
              message?: string;
              narration?: string;
              blueprint?: ArchitectureBlueprint;
              error?: string;
              index?: number;
              total?: number;
              chapter?: ArchitectureBlueprint["chapters"][number];
              projectName?: string;
              summary?: string;
              techStack?: ArchitectureBlueprint["techStack"];
              assumptions?: string[];
              tradeOffs?: ArchitectureBlueprint["tradeOffs"];
              risks?: ArchitectureBlueprint["risks"];
            };

            if (payload.type === "narration" && payload.delta) {
              appendNarration(payload.delta);
            } else if (payload.type === "status" && payload.message) {
              if (!receivedNarrationTokens) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: payload.message! }
                      : m,
                  ),
                );
              } else {
                // Soft footnote under streaming answer (ChatGPT-like progress)
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: `${narration}\n\n_${payload.message}_`,
                        }
                      : m,
                  ),
                );
              }
            } else if (payload.type === "meta" && payload.projectName) {
              meta = {
                projectName: payload.projectName,
                summary: payload.summary || "",
                techStack: payload.techStack || [],
                assumptions: payload.assumptions || [],
                tradeOffs: payload.tradeOffs || [],
                risks: payload.risks || [],
              };
              applyChaptersProgressively({
                ...meta,
                chapters: [],
              });
            } else if (payload.type === "chapter" && payload.chapter) {
              streamedChapters.push(payload.chapter);
              applyChaptersProgressively({
                projectName:
                  payload.projectName || meta?.projectName || "Architecture",
                summary: payload.summary || meta?.summary || "",
                techStack: payload.techStack || meta?.techStack || [],
                assumptions: payload.assumptions || meta?.assumptions || [],
                tradeOffs: payload.tradeOffs || meta?.tradeOffs || [],
                risks: payload.risks || meta?.risks || [],
                chapters: [...streamedChapters],
              });
              if (receivedNarrationTokens) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: narration,
                        }
                      : m,
                  ),
                );
              }
            } else if (payload.type === "complete" && payload.blueprint) {
              narration = payload.narration || narration;
              completedBlueprint = payload.blueprint;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: narration }
                    : m,
                ),
              );
            } else if (payload.type === "error") {
              throw new Error(payload.error || "Stream error");
            }
          }
        }

        if (!completedBlueprint) {
          throw new Error("Stream ended without a blueprint");
        }

        const withAssistant = [
          ...nextMessages,
          {
            id: assistantId,
            role: "assistant" as const,
            content: narration,
            createdAt: Date.now(),
          },
        ];
        setMessages(withAssistant);
        applyBlueprint(completedBlueprint);
        persist({
          messages: withAssistant,
          blueprint: completedBlueprint,
          elements: blueprintToExcalidrawElements(
            completedBlueprint,
          ) as SceneElement[],
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setError(message);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: m.content?.trim()
                    ? `${m.content}\n\nCould not finish blueprint: ${message}`
                    : `Could not generate blueprint: ${message}`,
                }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      messages,
      provider,
      blueprint,
      applyBlueprint,
      applyChaptersProgressively,
      persist,
    ],
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
        <div className="flex items-center gap-3">
          {!chatOpen && (
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="hidden text-xs text-[var(--muted)] hover:text-[var(--ink)] md:inline"
            >
              Open chat
            </button>
          )}
          {error && (
            <p className="max-w-md truncate text-xs text-red-700" title={error}>
              {error}
            </p>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {chatOpen ? (
          <div className="hidden w-[360px] shrink-0 md:flex md:flex-col">
            <ChatSidebar
              messages={messages}
              provider={provider}
              isLoading={isLoading}
              onProviderChange={setProvider}
              onSend={handleSend}
              onClear={handleClear}
              onCollapse={() => setChatOpen(false)}
            />
          </div>
        ) : (
          <div className="hidden w-10 shrink-0 flex-col items-center border-r border-[var(--line)] bg-[var(--panel)] py-3 md:flex">
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]"
              style={{ writingMode: "vertical-rl" }}
              aria-label="Open chat"
            >
              Chat
            </button>
          </div>
        )}

        <div className="relative min-w-0 flex-1">
          <div className="md:hidden">
            <details className="border-b border-[var(--line)] bg-[var(--panel)]" open={chatOpen}>
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

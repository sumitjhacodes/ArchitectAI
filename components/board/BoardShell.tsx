"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { blueprintToExcalidrawElements } from "@/lib/architecture/blueprint-to-excalidraw";
import { downloadPlanPackage } from "@/lib/architecture/export-plan";
import {
  mergeAiSceneWithUserEdits,
  renameFromBlueprint,
  shouldWipeCanvas,
  type RefineMode,
} from "@/lib/architecture/scene-merge";
import type { ArchitectureBlueprint } from "@/lib/architecture/schema";
import { track } from "@/lib/telemetry";
import {
  clearActiveBoardContent,
  createBoard,
  deleteBoard,
  duplicateBoard,
  getActiveBoardId,
  listBoards,
  loadActiveBoard,
  loadSettings,
  renameBoard,
  saveBoardRecord,
  saveSettings,
  setActiveBoard,
} from "@/lib/storage/board-storage";
import type {
  AiProvider,
  BoardMeta,
  BoardRecord,
  ChatMessage,
  ProjectConstraints,
} from "@/types/board";
import { BoardSwitcher } from "./BoardSwitcher";
import { ChatSidebar } from "./ChatSidebar";
import { DocsPanel } from "./DocsPanel";
import { SettingsDrawer } from "./SettingsDrawer";
import { WhiteboardCanvas } from "./WhiteboardCanvas";

type SceneElement = {
  id: string;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function applyRecordToState(
  board: BoardRecord,
  setters: {
    setBoardId: (id: string) => void;
    setBoardName: (n: string) => void;
    setProvider: (p: AiProvider) => void;
    setMessages: (m: ChatMessage[]) => void;
    setBlueprint: (b: ArchitectureBlueprint | null) => void;
    setDocsOpen: (v: boolean) => void;
    setChatOpen: (v: boolean) => void;
    setConstraints: (c: ProjectConstraints) => void;
    setFailedChapters: (f: string[]) => void;
    setSceneElements: (e: readonly SceneElement[]) => void;
    setSceneAppState: (
      a: {
        scrollX?: number;
        scrollY?: number;
        zoom?: { value: number };
        viewBackgroundColor?: string;
      } | null,
    ) => void;
    setSceneRevision: (fn: (n: number) => number) => void;
    liveElementsRef: MutableRefObject<readonly SceneElement[]>;
    liveAppStateRef: MutableRefObject<{
      scrollX?: number;
      scrollY?: number;
      zoom?: { value: number };
      viewBackgroundColor?: string;
    } | null>;
  },
) {
  setters.setBoardId(board.id);
  setters.setBoardName(board.name);
  setters.setProvider(board.provider);
  setters.setMessages(board.messages);
  setters.setBlueprint(board.blueprint);
  setters.setDocsOpen(board.docsOpen);
  setters.setChatOpen(board.chatOpen ?? true);
  setters.setConstraints(board.constraints ?? {});
  setters.setFailedChapters(board.failedChapters ?? []);

  const savedElements = board.scene?.elements as SceneElement[] | undefined;
  if (savedElements?.length) {
    setters.liveElementsRef.current = savedElements;
    setters.setSceneElements(savedElements);
    if (board.scene?.appState) {
      setters.liveAppStateRef.current = board.scene.appState;
      setters.setSceneAppState(board.scene.appState);
    }
    setters.setSceneRevision((n) => n + 1);
  } else if (board.blueprint) {
    try {
      const rebuilt = blueprintToExcalidrawElements(
        board.blueprint,
      ) as SceneElement[];
      setters.liveElementsRef.current = rebuilt;
      setters.setSceneElements(rebuilt);
      setters.setSceneRevision((n) => n + 1);
    } catch {
      setters.liveElementsRef.current = [];
      setters.setSceneElements([]);
      setters.setSceneRevision((n) => n + 1);
    }
  } else {
    setters.liveElementsRef.current = [];
    setters.setSceneElements([]);
    setters.setSceneAppState(null);
    setters.setSceneRevision((n) => n + 1);
  }
}

export function BoardShell() {
  const [hydrated, setHydrated] = useState(false);
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [boardName, setBoardName] = useState("Untitled architecture");
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [blueprint, setBlueprint] = useState<ArchitectureBlueprint | null>(
    null,
  );
  const [constraints, setConstraints] = useState<ProjectConstraints>({});
  const [refineMode, setRefineMode] = useState<RefineMode>("full");
  const [failedChapters, setFailedChapters] = useState<string[]>([]);
  const [docsOpen, setDocsOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneElements, setSceneElements] = useState<readonly SceneElement[]>(
    [],
  );
  const [sceneAppState, setSceneAppState] = useState<{
    scrollX?: number;
    scrollY?: number;
    zoom?: { value: number };
    viewBackgroundColor?: string;
  } | null>(null);
  const [sceneRevision, setSceneRevision] = useState(0);

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveElementsRef = useRef<readonly SceneElement[]>([]);
  const liveAppStateRef = useRef<{
    scrollX?: number;
    scrollY?: number;
    zoom?: { value: number };
    viewBackgroundColor?: string;
  } | null>(null);
  const boardMetaRef = useRef({
    boardId,
    boardName,
    provider,
    messages,
    blueprint,
    docsOpen,
    chatOpen,
    constraints,
    failedChapters,
  });
  boardMetaRef.current = {
    boardId,
    boardName,
    provider,
    messages,
    blueprint,
    docsOpen,
    chatOpen,
    constraints,
    failedChapters,
  };

  const refreshBoardList = useCallback(() => {
    setBoards(listBoards());
  }, []);

  useEffect(() => {
    try {
      const settings = loadSettings();
      let board = loadActiveBoard();
      if (!board) {
        board = createBoard("Untitled architecture", settings.provider);
      }
      setProvider(settings.provider || board.provider);
      applyRecordToState(
        { ...board, provider: settings.provider || board.provider },
        {
          setBoardId,
          setBoardName,
          setProvider,
          setMessages,
          setBlueprint,
          setDocsOpen,
          setChatOpen,
          setConstraints,
          setFailedChapters,
          setSceneElements,
          setSceneAppState,
          setSceneRevision,
          liveElementsRef,
          liveAppStateRef,
        },
      );
      if (board.blueprint) setRefineMode("patch");
      refreshBoardList();
    } catch (err) {
      console.error("Failed to restore board", err);
      try {
        const board = createBoard("Untitled architecture", "gemini");
        applyRecordToState(board, {
          setBoardId,
          setBoardName,
          setProvider,
          setMessages,
          setBlueprint,
          setDocsOpen,
          setChatOpen,
          setConstraints,
          setFailedChapters,
          setSceneElements,
          setSceneAppState,
          setSceneRevision,
          liveElementsRef,
          liveAppStateRef,
        });
        refreshBoardList();
      } catch {
        // last resort: still leave restoring UI
      }
    } finally {
      setHydrated(true);
    }
  }, [refreshBoardList]);

  const persist = useCallback(
    (partial?: {
      messages?: ChatMessage[];
      blueprint?: ArchitectureBlueprint | null;
      provider?: AiProvider;
      docsOpen?: boolean;
      chatOpen?: boolean;
      elements?: readonly SceneElement[];
      appState?: typeof sceneAppState;
      constraints?: ProjectConstraints;
      failedChapters?: string[];
      name?: string;
    }) => {
      if (!hydrated) return;
      const meta = boardMetaRef.current;
      if (!meta.boardId) return;
      const elements = [
        ...(partial?.elements ??
          liveElementsRef.current ??
          sceneElements),
      ] as unknown[];
      const appState =
        partial && "appState" in partial
          ? partial.appState
          : (liveAppStateRef.current ?? sceneAppState);
      const nextBlueprint =
        partial && "blueprint" in partial
          ? (partial.blueprint ?? null)
          : meta.blueprint;
      const name = renameFromBlueprint(
        partial?.name ?? meta.boardName,
        nextBlueprint,
      );
      const existing = loadActiveBoard();
      saveBoardRecord({
        version: 2,
        id: meta.boardId,
        name,
        provider: partial?.provider ?? meta.provider,
        messages: partial?.messages ?? meta.messages,
        blueprint: nextBlueprint,
        docsOpen: partial?.docsOpen ?? meta.docsOpen,
        chatOpen: partial?.chatOpen ?? meta.chatOpen,
        constraints: partial?.constraints ?? meta.constraints,
        failedChapters: partial?.failedChapters ?? meta.failedChapters,
        scene: {
          elements,
          ...(appState ? { appState } : {}),
        },
        createdAt:
          existing?.id === meta.boardId
            ? existing.createdAt
            : Date.now(),
        updatedAt: Date.now(),
      });
      setBoardName(name);
      refreshBoardList();
      // Best-effort durable sync — slim payload to avoid blowing client/server storage
      void fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: meta.boardId,
          name,
          blueprint: nextBlueprint,
          payload: {
            messages: (partial?.messages ?? meta.messages).slice(-12),
            constraints: partial?.constraints ?? meta.constraints,
          },
        }),
      }).catch(() => undefined);
    },
    [hydrated, sceneElements, sceneAppState, refreshBoardList],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(), 400);
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
    constraints,
    failedChapters,
    persist,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    const flush = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      persist();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [hydrated, persist]);

  const applyBlueprint = useCallback(
    (next: ArchitectureBlueprint, mode: RefineMode) => {
      const aiElements = blueprintToExcalidrawElements(next) as SceneElement[];
      const merged =
        mode === "full"
          ? aiElements
          : mergeAiSceneWithUserEdits(aiElements, liveElementsRef.current);
      liveElementsRef.current = merged;
      setBlueprint(next);
      setSceneElements(merged);
      setSceneRevision((n) => n + 1);
      setRefineMode("patch");
      setBoardName((prev) => renameFromBlueprint(prev, next));
    },
    [],
  );

  const applyChaptersProgressively = useCallback(
    (
      partial: {
        projectName: string;
        summary: string;
        techStack: ArchitectureBlueprint["techStack"];
        assumptions: string[];
        tradeOffs: ArchitectureBlueprint["tradeOffs"];
        risks: ArchitectureBlueprint["risks"];
        chapters: ArchitectureBlueprint["chapters"];
      },
      mode: RefineMode,
    ) => {
      applyBlueprint(
        {
          projectName: partial.projectName,
          summary: partial.summary,
          techStack: partial.techStack,
          assumptions: partial.assumptions,
          tradeOffs: partial.tradeOffs,
          risks: partial.risks,
          chapters: partial.chapters,
        },
        mode,
      );
    },
    [applyBlueprint],
  );

  const runGeneration = useCallback(
    async (opts: {
      text: string;
      refineAction?: "challenge-stack" | "tighten-mvp";
      retryChapterTitle?: string;
      modeOverride?: RefineMode;
    }) => {
      setError(null);
      const mode =
        opts.modeOverride ??
        (blueprint && refineMode === "patch" ? "patch" : "full");
      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: opts.retryChapterTitle
          ? `Retry chapter: ${opts.retryChapterTitle}`
          : opts.text,
        createdAt: Date.now(),
      };
      const nextMessages = opts.retryChapterTitle
        ? messages
        : [...messages, userMessage];
      const assistantId = newId();
      if (!opts.retryChapterTitle) {
        setMessages([
          ...nextMessages,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            createdAt: Date.now(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: `Retrying “${opts.retryChapterTitle}”…`,
            createdAt: Date.now(),
          },
        ]);
      }
      setIsLoading(true);
      track("generation_started", { mode, provider });

      if (shouldWipeCanvas(mode, !!blueprint) && !opts.retryChapterTitle) {
        liveElementsRef.current = [];
        setBlueprint(null);
        setSceneElements([]);
        setSceneRevision((n) => n + 1);
        setFailedChapters([]);
      }

      try {
        const res = await fetch("/api/architect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            mode,
            refineAction: opts.refineAction,
            constraints,
            retryChapterTitle: opts.retryChapterTitle,
            messages: (opts.retryChapterTitle
              ? [
                  ...messages,
                  {
                    role: "user" as const,
                    content: `Retry failed chapter: ${opts.retryChapterTitle}`,
                  },
                ]
              : nextMessages
            ).map((m) => ({
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
        let streamFailed: string[] = [];
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
            const line = part.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const payload = JSON.parse(line.slice(6)) as {
              type: string;
              delta?: string;
              message?: string;
              narration?: string;
              blueprint?: ArchitectureBlueprint;
              error?: string;
              title?: string;
              failedChapters?: string[];
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
            } else if (payload.type === "chapter" && payload.chapter) {
              const existingIdx = streamedChapters.findIndex(
                (c) => c.title === payload.chapter!.title,
              );
              if (existingIdx >= 0) {
                streamedChapters[existingIdx] = payload.chapter;
              } else {
                streamedChapters.push(payload.chapter);
              }
              applyChaptersProgressively(
                {
                  projectName:
                    payload.projectName ||
                    meta?.projectName ||
                    blueprint?.projectName ||
                    "Architecture",
                  summary:
                    payload.summary ||
                    meta?.summary ||
                    blueprint?.summary ||
                    "",
                  techStack:
                    payload.techStack ||
                    meta?.techStack ||
                    blueprint?.techStack ||
                    [],
                  assumptions:
                    payload.assumptions ||
                    meta?.assumptions ||
                    blueprint?.assumptions ||
                    [],
                  tradeOffs:
                    payload.tradeOffs ||
                    meta?.tradeOffs ||
                    blueprint?.tradeOffs ||
                    [],
                  risks:
                    payload.risks || meta?.risks || blueprint?.risks || [],
                  chapters:
                    opts.retryChapterTitle && blueprint
                      ? blueprint.chapters.map((c) =>
                          c.title === payload.chapter!.title
                            ? payload.chapter!
                            : c,
                        )
                      : [...streamedChapters],
                },
                mode,
              );
              if (receivedNarrationTokens) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: narration } : m,
                  ),
                );
              }
            } else if (payload.type === "chapter_failed" && payload.title) {
              streamFailed.push(payload.title);
              setFailedChapters([...streamFailed]);
            } else if (payload.type === "complete" && payload.blueprint) {
              narration = payload.narration || narration;
              completedBlueprint = payload.blueprint;
              streamFailed = payload.failedChapters ?? streamFailed;
              setFailedChapters(streamFailed);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: narration } : m,
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
          ...(opts.retryChapterTitle ? messages : nextMessages),
          {
            id: assistantId,
            role: "assistant" as const,
            content: narration,
            createdAt: Date.now(),
          },
        ];
        setMessages(withAssistant);
        applyBlueprint(completedBlueprint, mode);
        persist({
          messages: withAssistant,
          blueprint: completedBlueprint,
          failedChapters: streamFailed,
          elements: liveElementsRef.current,
        });
        track("generation_completed", {
          chapters: completedBlueprint.chapters.length,
          failed: streamFailed.length,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setError(message);
        track("generation_failed", { message });
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
      constraints,
      refineMode,
      applyBlueprint,
      applyChaptersProgressively,
      persist,
    ],
  );

  const handleSend = useCallback(
    (
      text: string,
      opts?: { refineAction?: "challenge-stack" | "tighten-mvp" },
    ) => {
      void runGeneration({
        text,
        refineAction: opts?.refineAction,
      });
    },
    [runGeneration],
  );

  const handleRetryChapter = useCallback(
    (title: string) => {
      void runGeneration({
        text: `Retry ${title}`,
        retryChapterTitle: title,
        modeOverride: "patch",
      });
    },
    [runGeneration],
  );

  const switchToBoard = useCallback(
    (id: string) => {
      persist();
      setActiveBoard(id);
      const board = loadActiveBoard();
      if (!board) return;
      applyRecordToState(board, {
        setBoardId,
        setBoardName,
        setProvider,
        setMessages,
        setBlueprint,
        setDocsOpen,
        setChatOpen,
        setConstraints,
        setFailedChapters,
        setSceneElements,
        setSceneAppState,
        setSceneRevision,
        liveElementsRef,
        liveAppStateRef,
      });
      setRefineMode(board.blueprint ? "patch" : "full");
      refreshBoardList();
    },
    [persist, refreshBoardList],
  );

  const handleClear = useCallback(() => {
    clearActiveBoardContent();
    liveElementsRef.current = [];
    liveAppStateRef.current = null;
    setMessages([]);
    setBlueprint(null);
    setSceneElements([]);
    setSceneAppState(null);
    setFailedChapters([]);
    setConstraints({});
    setRefineMode("full");
    setSceneRevision((n) => n + 1);
    setError(null);
    apiRef.current?.resetScene();
    refreshBoardList();
  }, [refreshBoardList]);

  const handleCanvasChange = useCallback(
    (
      elements: readonly SceneElement[],
      appState: {
        scrollX: number;
        scrollY: number;
        zoom: { value: number };
        viewBackgroundColor: string;
      },
    ) => {
      liveElementsRef.current = elements;
      liveAppStateRef.current = {
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom,
        viewBackgroundColor: appState.viewBackgroundColor,
      };
      if (canvasSaveTimer.current) clearTimeout(canvasSaveTimer.current);
      canvasSaveTimer.current = setTimeout(() => {
        persist({
          elements: liveElementsRef.current,
          appState: liveAppStateRef.current,
        });
      }, 500);
    },
    [persist],
  );

  const handleExport = useCallback(() => {
    if (!blueprint) return;
    downloadPlanPackage({
      blueprint,
      scene: {
        elements: [...liveElementsRef.current] as unknown[],
        appState: liveAppStateRef.current ?? undefined,
      },
    });
    track("export_downloaded", { project: blueprint.projectName });
  }, [blueprint]);

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--bg)] text-sm text-[var(--muted)]">
        Restoring board…
      </div>
    );
  }

  const chatProps = {
    messages,
    isLoading,
    constraints,
    refineMode,
    hasBlueprint: !!blueprint,
    failedChapters,
    onConstraintsChange: setConstraints,
    onRefineModeChange: setRefineMode,
    onSend: handleSend,
    onRetryChapter: handleRetryChapter,
    onClear: handleClear,
    onOpenSettings: () => setSettingsOpen(true),
  };

  return (
    <div className="flex h-dvh flex-col bg-[var(--bg)] text-[var(--ink)]">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-4">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm font-semibold tracking-tight">
            ArchitectAI
          </a>
          <BoardSwitcher
            boards={boards}
            activeId={boardId ?? getActiveBoardId()}
            onSelect={switchToBoard}
            onCreate={() => {
              persist();
              const board = createBoard("Untitled architecture", provider);
              applyRecordToState(board, {
                setBoardId,
                setBoardName,
                setProvider,
                setMessages,
                setBlueprint,
                setDocsOpen,
                setChatOpen,
                setConstraints,
                setFailedChapters,
                setSceneElements,
                setSceneAppState,
                setSceneRevision,
                liveElementsRef,
                liveAppStateRef,
              });
              setRefineMode("full");
              refreshBoardList();
            }}
            onRename={(id, name) => {
              renameBoard(id, name);
              if (id === boardId) setBoardName(name);
              refreshBoardList();
            }}
            onDuplicate={(id) => {
              persist();
              const copy = duplicateBoard(id);
              if (!copy) return;
              applyRecordToState(copy, {
                setBoardId,
                setBoardName,
                setProvider,
                setMessages,
                setBlueprint,
                setDocsOpen,
                setChatOpen,
                setConstraints,
                setFailedChapters,
                setSceneElements,
                setSceneAppState,
                setSceneRevision,
                liveElementsRef,
                liveAppStateRef,
              });
              setRefineMode(copy.blueprint ? "patch" : "full");
              refreshBoardList();
            }}
            onDelete={(id) => {
              deleteBoard(id);
              const next = loadActiveBoard();
              if (next) {
                applyRecordToState(next, {
                  setBoardId,
                  setBoardName,
                  setProvider,
                  setMessages,
                  setBlueprint,
                  setDocsOpen,
                  setChatOpen,
                  setConstraints,
                  setFailedChapters,
                  setSceneElements,
                  setSceneAppState,
                  setSceneRevision,
                  liveElementsRef,
                  liveAppStateRef,
                });
                setRefineMode(next.blueprint ? "patch" : "full");
              }
              refreshBoardList();
            }}
          />
          <span className="hidden text-xs text-[var(--muted)] sm:inline">
            {boardName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {blueprint && (
            <button
              type="button"
              onClick={handleExport}
              className="hidden text-xs font-medium text-[var(--accent)] hover:underline sm:inline"
            >
              Download plan
            </button>
          )}
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
            <ChatSidebar {...chatProps} onCollapse={() => setChatOpen(false)} />
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
            <details
              className="border-b border-[var(--line)] bg-[var(--panel)]"
              open={chatOpen}
            >
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                Chat
              </summary>
              <div className="h-72 border-t border-[var(--line)]">
                <ChatSidebar {...chatProps} />
              </div>
            </details>
          </div>
          <div className="h-[calc(100%-0px)] min-h-[420px] md:h-full">
            <WhiteboardCanvas
              sceneRevision={sceneRevision}
              elements={sceneElements}
              appState={sceneAppState}
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
            onExport={blueprint ? handleExport : undefined}
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
              onExport={blueprint ? handleExport : undefined}
            />
          </div>
        </details>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        provider={provider}
        onProviderChange={(p) => {
          setProvider(p);
          saveSettings({ provider: p });
        }}
      />
    </div>
  );
}

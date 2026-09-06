"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

type SceneElement = {
  id: string;
  [key: string]: unknown;
};

export type SceneAppState = {
  scrollX?: number;
  scrollY?: number;
  zoom?: { value: number };
  viewBackgroundColor?: string;
};

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[var(--canvas-bg)] text-sm text-[var(--muted)]">
        Loading whiteboard…
      </div>
    ),
  },
);

type Props = {
  /** Bumps when AI / restore applies a new scene so the canvas updates. */
  sceneRevision: number;
  elements: readonly SceneElement[] | null;
  appState?: SceneAppState | null;
  onApiReady?: (api: ExcalidrawImperativeAPI) => void;
  onChange?: (
    elements: readonly SceneElement[],
    appState: AppState,
  ) => void;
};

export function WhiteboardCanvas({
  sceneRevision,
  elements,
  appState,
  onApiReady,
  onChange,
}: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const elementsRef = useRef(elements);
  const onChangeRef = useRef(onChange);
  const appliedRevision = useRef<number | null>(null);
  const ignoreChangeRef = useRef(false);
  const [apiReady, setApiReady] = useState(false);

  // Freeze first-paint scene so Excalidraw does not remount on parent renders
  const initialDataRef = useRef({
    elements: (elements ?? []) as SceneElement[],
    appState: {
      viewBackgroundColor: appState?.viewBackgroundColor ?? "#f5f5f4",
      currentItemFontFamily: 1 as const,
      ...(typeof appState?.scrollX === "number"
        ? { scrollX: appState.scrollX }
        : {}),
      ...(typeof appState?.scrollY === "number"
        ? { scrollY: appState.scrollY }
        : {}),
      ...(appState?.zoom ? { zoom: appState.zoom } : {}),
    },
    scrollToContent: (elements?.length ?? 0) > 0 && !appState?.zoom,
  });

  elementsRef.current = elements;
  onChangeRef.current = onChange;

  const handleChange = useCallback(
    (
      nextElements: readonly SceneElement[],
      nextAppState: AppState,
      _files: BinaryFiles,
    ) => {
      if (ignoreChangeRef.current) return;
      onChangeRef.current?.(nextElements, nextAppState);
    },
    [],
  );

  // Programmatic scene apply (restore / AI) — never inside excalidrawAPI callback
  useEffect(() => {
    if (!apiReady) return;
    const api = apiRef.current;
    if (!api) return;
    if (appliedRevision.current === sceneRevision) return;

    ignoreChangeRef.current = true;
    api.updateScene({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elements: (elementsRef.current ?? []) as any,
    });
    const next = elementsRef.current ?? [];
    if (next.length && sceneRevision > 0) {
      api.scrollToContent(undefined, {
        fitToContent: !appState?.zoom,
        animate: false,
      });
    }
    appliedRevision.current = sceneRevision;
    // Let Excalidraw finish emitting change events from updateScene
    requestAnimationFrame(() => {
      ignoreChangeRef.current = false;
    });
  }, [apiReady, sceneRevision, appState?.zoom]);

  return (
    <div
      className="relative h-full w-full excalidraw-wrapper"
      suppressHydrationWarning
    >
      <Excalidraw
        excalidrawAPI={(api) => {
          if (apiRef.current === api) return;
          apiRef.current = api;
          onApiReady?.(api);
          setApiReady(true);
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialData={initialDataRef.current as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onChange={handleChange as any}
        theme="light"
        UIOptions={{
          canvasActions: {
            loadScene: true,
            export: { saveFileToDisk: true },
            toggleTheme: false,
          },
        }}
      />
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef } from "react";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

type SceneElement = {
  id: string;
  [key: string]: unknown;
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
  /** Bumps when AI applies a new scene so the canvas updates. */
  sceneRevision: number;
  elements: readonly SceneElement[] | null;
  onApiReady?: (api: ExcalidrawImperativeAPI) => void;
  onChange?: (elements: readonly SceneElement[], appState: AppState) => void;
};

export function WhiteboardCanvas({
  sceneRevision,
  elements,
  onApiReady,
  onChange,
}: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const handleChange = useCallback(
    (
      nextElements: readonly SceneElement[],
      appState: AppState,
      _files: BinaryFiles,
    ) => {
      onChange?.(nextElements, appState);
    },
    [onChange],
  );

  useEffect(() => {
    if (!apiRef.current || sceneRevision === 0) return;
    const next = elementsRef.current ?? [];
    apiRef.current.updateScene({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elements: next as any,
    });
    if (next.length) {
      apiRef.current.scrollToContent(undefined, {
        fitToContent: true,
        animate: true,
      });
    }
  }, [sceneRevision]);

  return (
    <div className="relative h-full w-full excalidraw-wrapper" suppressHydrationWarning>
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
          onApiReady?.(api);
        }}
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

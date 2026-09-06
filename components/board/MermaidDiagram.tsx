"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  code: string;
  title?: string;
};

let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "neutral",
        fontFamily: "inherit",
        flowchart: {
          curve: "basis",
          padding: 12,
          nodeSpacing: 40,
          rankSpacing: 50,
          htmlLabels: false,
        },
      });
      return mermaid;
    });
  }
  return mermaidReady;
}

function fallbackSvg(message: string): string {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="56" role="img" aria-label="${safe}">
  <rect width="100%" height="100%" fill="#f7f6f3" rx="4"/>
  <text x="16" y="34" fill="#6b6b6b" font-size="12" font-family="system-ui,sans-serif">${safe}</text>
</svg>`;
}

export function MermaidDiagram({ code, title }: Props) {
  const reactId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current || !code.trim()) return;
      setFailed(false);
      try {
        const mermaid = await getMermaid();
        const id = `mmd-${reactId}-${Math.random().toString(36).slice(2, 9)}`;

        try {
          await mermaid.parse(code);
        } catch {
          if (!cancelled && containerRef.current) {
            setFailed(true);
            containerRef.current.innerHTML = fallbackSvg(
              "Diagram skipped — invalid flow syntax",
            );
          }
          return;
        }

        const { svg } = await mermaid.render(id, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled && containerRef.current) {
          setFailed(true);
          containerRef.current.innerHTML = fallbackSvg(
            "Diagram skipped — could not render",
          );
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [code, reactId]);

  return (
    <div className="mb-4 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--bg)]">
      {title && (
        <p className="border-b border-[var(--line)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)]">
          {title}
          {failed ? " (unavailable)" : ""}
        </p>
      )}
      <div
        ref={containerRef}
        className="overflow-x-auto p-2 [&_svg]:mx-auto [&_svg]:max-w-full"
      />
    </div>
  );
}

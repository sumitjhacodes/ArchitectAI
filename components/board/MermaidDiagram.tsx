"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  code: string;
  title?: string;
};

export function MermaidDiagram({ code, title }: Props) {
  const reactId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current || !code.trim()) return;
      setError(null);
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "inherit",
          flowchart: {
            curve: "basis",
            padding: 12,
            nodeSpacing: 40,
            rankSpacing: 50,
          },
        });

        const id = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not render diagram",
          );
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  return (
    <div className="mb-4 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--bg)]">
      {title && (
        <p className="border-b border-[var(--line)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)]">
          {title}
        </p>
      )}
      {error ? (
        <pre className="overflow-x-auto p-2 font-mono text-[10px] text-red-700">
          {error}
          {"\n\n"}
          {code}
        </pre>
      ) : (
        <div
          ref={containerRef}
          className="overflow-x-auto p-2 [&_svg]:mx-auto [&_svg]:max-w-full"
        />
      )}
    </div>
  );
}

"use client";

import { blueprintToMarkdown } from "@/lib/architecture/blueprint-to-markdown";
import type { ArchitectureBlueprint } from "@/lib/architecture/schema";

type Props = {
  blueprint: ArchitectureBlueprint | null;
  open: boolean;
  onToggle: () => void;
};

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[var(--ink)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function DocsPanel({ blueprint, open, onToggle }: Props) {
  if (!open) {
    return (
      <div className="flex h-full w-10 flex-col items-center border-l border-[var(--line)] bg-[var(--panel)] py-3">
        <button
          type="button"
          onClick={onToggle}
          className="writing-mode-vertical rotate-180 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]"
          style={{ writingMode: "vertical-rl" }}
          aria-label="Open docs"
        >
          Docs
        </button>
      </div>
    );
  }

  const markdown = blueprint ? blueprintToMarkdown(blueprint) : null;
  const blocks = markdown ? markdown.split("\n") : [];

  return (
    <aside className="flex h-full w-full max-w-[320px] flex-col border-l border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">Docs</p>
          <p className="text-[11px] text-[var(--muted)]">
            {blueprint ? blueprint.projectName : "No blueprint yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Collapse
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 text-sm leading-relaxed">
        {!blueprint && (
          <p className="text-[var(--muted)]">
            After you generate a blueprint, chapter steps and commands appear
            here alongside the canvas diagrams.
          </p>
        )}

        {blocks.map((line, index) => {
          if (line.startsWith("# ")) {
            return (
              <h2
                key={index}
                className="mb-2 text-base font-semibold tracking-tight"
              >
                {line.slice(2)}
              </h2>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <h3
                key={index}
                className="mb-1.5 mt-4 text-sm font-semibold text-[var(--ink)]"
              >
                {line.slice(3)}
              </h3>
            );
          }
          if (line.startsWith("### ")) {
            return (
              <h4
                key={index}
                className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
              >
                {line.slice(4)}
              </h4>
            );
          }
          if (line === "```") {
            return null;
          }
          if (
            index > 0 &&
            blocks[index - 1] === "```" &&
            blocks[index + 1] === "```"
          ) {
            return (
              <pre
                key={index}
                className="mb-2 overflow-x-auto rounded bg-[var(--ink)] px-2.5 py-2 font-mono text-[11px] text-[var(--panel)]"
              >
                {line}
              </pre>
            );
          }
          if (line.startsWith("- ")) {
            return (
              <li key={index} className="ml-4 list-disc text-[var(--ink)]">
                {renderInline(line.slice(2))}
              </li>
            );
          }
          if (!line.trim()) {
            return <div key={index} className="h-2" />;
          }
          return (
            <p key={index} className="text-[var(--ink)]/90">
              {renderInline(line)}
            </p>
          );
        })}
      </div>
    </aside>
  );
}

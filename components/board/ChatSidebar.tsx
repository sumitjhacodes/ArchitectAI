"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ProjectConstraints } from "@/types/board";
import type { RefineMode } from "@/lib/architecture/scene-merge";

const STARTERS = [
  {
    label: "Auth + Postgres web app",
    text: "Design a Next.js app with email/password auth, Postgres, and a simple dashboard. Include local setup and deploy.",
  },
  {
    label: "Async jobs + webhooks",
    text: "Architecture for a product that ingests webhooks, runs background jobs, and stores results in Postgres. Prefer a small MVP stack.",
  },
  {
    label: "Internal admin tool",
    text: "Build an internal admin tool with role-based access, audit logs, and a relational data model. Keep ops simple.",
  },
];

const SCALE_OPTIONS = ["Prototype", "MVP (~1k users)", "Growth (~100k)", "Unsure"];
const TIMELINE_OPTIONS = ["2–4 weeks", "6–10 weeks", "3+ months", "Unsure"];

type Props = {
  messages: ChatMessage[];
  isLoading: boolean;
  constraints: ProjectConstraints;
  refineMode: RefineMode;
  hasBlueprint: boolean;
  failedChapters?: string[];
  onConstraintsChange: (c: ProjectConstraints) => void;
  onRefineModeChange: (m: RefineMode) => void;
  onSend: (text: string, opts?: { refineAction?: "challenge-stack" | "tighten-mvp" }) => void;
  onRetryChapter?: (title: string) => void;
  onClear: () => void;
  onCollapse?: () => void;
  onOpenSettings?: () => void;
};

function renderAssistantText(content: string) {
  return content.split("\n").map((line, i) => {
    if (line.startsWith("_") && line.endsWith("_") && line.length > 2) {
      return (
        <p key={i} className="mt-3 text-xs italic text-[var(--muted)]">
          {line.slice(1, -1)}
        </p>
      );
    }
    if (!line.trim()) return <div key={i} className="h-2" />;
    return (
      <p key={i} className="text-[15px] leading-7 text-[var(--ink)]">
        {line}
      </p>
    );
  });
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded border px-2 py-1 text-[11px] ${
              value === opt
                ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--ink)]"
                : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatSidebar({
  messages,
  isLoading,
  constraints,
  refineMode,
  hasBlueprint,
  failedChapters,
  onConstraintsChange,
  onRefineModeChange,
  onSend,
  onRetryChapter,
  onClear,
  onCollapse,
  onOpenSettings,
}: Props) {
  const [draft, setDraft] = useState("");
  const [preferDraft, setPreferDraft] = useState(
    constraints.preferredTech?.join(", ") ?? "",
  );
  const [avoidDraft, setAvoidDraft] = useState(
    constraints.avoidTech?.join(", ") ?? "",
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function submit(text: string, refineAction?: "challenge-stack" | "tighten-mvp") {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    const preferredTech = preferDraft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const avoidTech = avoidDraft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onConstraintsChange({
      ...constraints,
      preferredTech,
      avoidTech,
    });
    onSend(trimmed, { refineAction });
    setDraft("");
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold tracking-tight">ArchitectAI</p>
          <p className="text-[11px] text-[var(--muted)]">
            Constraints → architecture → build plan
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Settings
            </button>
          )}
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
              title="Collapse chat"
            >
              Collapse
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Set constraints, then describe what you are building. ArchitectAI
              returns a reviewable architecture board and chaptered build steps.
            </p>
            <ChipRow
              label="Scale"
              options={SCALE_OPTIONS}
              value={constraints.scale}
              onChange={(scale) => onConstraintsChange({ ...constraints, scale })}
            />
            <ChipRow
              label="Timeline"
              options={TIMELINE_OPTIONS}
              value={constraints.timeline}
              onChange={(timeline) =>
                onConstraintsChange({ ...constraints, timeline })
              }
            />
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Must use
              </p>
              <input
                value={preferDraft}
                onChange={(e) => setPreferDraft(e.target.value)}
                placeholder="e.g. Next.js, Postgres"
                className="w-full rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Must avoid
              </p>
              <input
                value={avoidDraft}
                onChange={(e) => setAvoidDraft(e.target.value)}
                placeholder="e.g. Kafka, microservices"
                className="w-full rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Starters
              </p>
              {STARTERS.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => submit(example.text)}
                  className="block w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-left text-xs leading-snug text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  <span className="font-semibold">{example.label}</span>
                  <span className="mt-0.5 block text-[var(--muted)]">
                    {example.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isStreamingAssistant =
            isLoading &&
            message.role === "assistant" &&
            index === messages.length - 1;

          if (message.role === "user") {
            return (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[92%] rounded-2xl bg-[var(--ink)] px-3.5 py-2.5 text-[14px] leading-6 text-[var(--panel)]">
                  {message.content}
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className="max-w-[98%]">
              <p className="mb-1.5 text-[11px] font-medium text-[var(--muted)]">
                ArchitectAI
              </p>
              <div className="space-y-0">
                {renderAssistantText(message.content)}
                {isStreamingAssistant && (
                  <span className="mt-1 inline-block h-4 w-[3px] animate-pulse bg-[var(--ink)] align-middle" />
                )}
              </div>
            </div>
          );
        })}

        {!!failedChapters?.length && onRetryChapter && (
          <div className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
            <p className="font-semibold">Some chapters failed</p>
            <ul className="mt-1 space-y-1">
              {failedChapters.map((title) => (
                <li key={title} className="flex items-center justify-between gap-2">
                  <span>{title}</span>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => onRetryChapter(title)}
                    className="shrink-0 underline"
                  >
                    Retry
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasBlueprint && !isLoading && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() =>
                submit(
                  "Challenge the current tech stack. Propose simpler alternatives where justified.",
                  "challenge-stack",
                )
              }
              className="rounded border border-[var(--line)] px-2 py-1 text-[11px] hover:border-[var(--accent)]"
            >
              Challenge stack
            </button>
            <button
              type="button"
              onClick={() =>
                submit(
                  "Tighten this architecture for a true MVP. Cut non-essentials.",
                  "tighten-mvp",
                )
              }
              className="rounded border border-[var(--line)] px-2 py-1 text-[11px] hover:border-[var(--accent)]"
            >
              Tighten for MVP
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[var(--line)] p-3">
        {hasBlueprint && (
          <div className="mb-2 flex gap-1 rounded border border-[var(--line)] p-0.5">
            {(
              [
                ["patch", "Refine (keep board)"],
                ["full", "Full redesign"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => onRefineModeChange(mode)}
                className={`flex-1 rounded px-2 py-1 text-[10px] font-medium ${
                  refineMode === mode
                    ? "bg-[var(--ink)] text-[var(--panel)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
          className="space-y-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(draft);
              }
            }}
            rows={3}
            placeholder="Describe the product or ask to refine…"
            className="w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            disabled={isLoading}
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Clear board
            </button>
            <button
              type="submit"
              disabled={isLoading || !draft.trim()}
              className="rounded-lg bg-[var(--ink)] px-3.5 py-1.5 text-xs font-medium text-[var(--panel)] disabled:opacity-40"
            >
              {isLoading ? "Generating…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}

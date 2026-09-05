"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types/board";
import { ProviderSwitcher } from "./ProviderSwitcher";
import type { AiProvider } from "@/types/board";

const EXAMPLES = [
  "Build an AI job application agent with Next.js, Clerk, and Postgres",
  "Design a multi-tenant SaaS billing platform with Stripe",
  "Architecture for a realtime collaborative whiteboard",
];

type Props = {
  messages: ChatMessage[];
  provider: AiProvider;
  isLoading: boolean;
  onProviderChange: (provider: AiProvider) => void;
  onSend: (text: string) => void;
  onClear: () => void;
};

export function ChatSidebar({
  messages,
  provider,
  isLoading,
  onProviderChange,
  onSend,
  onClear,
}: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setDraft("");
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold tracking-tight">ArchitectAI</p>
          <p className="text-[11px] text-[var(--muted)]">Chat · blueprint agent</p>
        </div>
        <ProviderSwitcher
          value={provider}
          onChange={onProviderChange}
          disabled={isLoading}
        />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Ask ArchitectAI to design any project. It will draw architecture
              on the canvas and fill Docs with build steps.
            </p>
            <div className="space-y-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => submit(example)}
                  className="block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-left text-xs leading-snug text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-md border px-3 py-2 text-sm leading-relaxed ${
              message.role === "user"
                ? "border-[var(--line)] bg-[var(--bg)]"
                : "border-[var(--accent-soft)] bg-[var(--accent-tint)]"
            }`}
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {message.role === "user" ? "You" : "ArchitectAI"}
            </p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className="rounded-md border border-dashed border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)]">
            Drawing architecture blueprint…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[var(--line)] p-3">
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
            placeholder="Describe the project to architect…"
            className="w-full resize-none rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
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
              className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--panel)] disabled:opacity-40"
            >
              {isLoading ? "Working…" : "Generate"}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}

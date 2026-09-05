"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types/board";
import { ProviderSwitcher } from "./ProviderSwitcher";
import type { AiProvider } from "@/types/board";

const EXAMPLES = [
  "Build an AI job application agent with Next.js, Clerk, and Postgres — design through deploy",
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
  onCollapse?: () => void;
};

function renderAssistantText(content: string) {
  // Strip progress footnotes like _Writing chapter…_ for cleaner final look mid-stream we keep them
  return content.split("\n").map((line, i) => {
    if (line.startsWith("_") && line.endsWith("_") && line.length > 2) {
      return (
        <p
          key={i}
          className="mt-3 text-xs italic text-[var(--muted)]"
        >
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

export function ChatSidebar({
  messages,
  provider,
  isLoading,
  onProviderChange,
  onSend,
  onClear,
  onCollapse,
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
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold tracking-tight">ArchitectAI</p>
          <p className="text-[11px] text-[var(--muted)]">
            Chat streams · docs & board update live
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProviderSwitcher
            value={provider}
            onChange={onProviderChange}
            disabled={isLoading}
          />
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
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Describe the product. ArchitectAI responds in chat, writes the
              build guide in Docs, and draws each architecture chapter on the
              board — from design through deployment.
            </p>
            <div className="space-y-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => submit(example)}
                  className="block w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-left text-xs leading-snug text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  {example}
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
            placeholder="Message ArchitectAI…"
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

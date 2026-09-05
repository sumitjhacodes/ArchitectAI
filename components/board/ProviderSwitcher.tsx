"use client";

import type { AiProvider } from "@/types/board";

const OPTIONS: { id: AiProvider; label: string }[] = [
  { id: "gemini", label: "A" },
  { id: "groq", label: "B" },
];

type Props = {
  value: AiProvider;
  onChange: (provider: AiProvider) => void;
  disabled?: boolean;
};

export function ProviderSwitcher({ value, onChange, disabled }: Props) {
  return (
    <div
      className="inline-flex rounded-md border border-[var(--line)] bg-[var(--panel)] p-0.5"
      role="group"
      aria-label="Generation engine"
      title="Switch generation engine"
    >
      {OPTIONS.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`min-w-8 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-[var(--ink)] text-[var(--panel)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            } disabled:opacity-50`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

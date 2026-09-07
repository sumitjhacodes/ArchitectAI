"use client";

import { useEffect, useState } from "react";
import type { AiProvider } from "@/types/board";
import { loadSettings, saveSettings } from "@/lib/storage/board-storage";
import { ProviderSwitcher } from "./ProviderSwitcher";

type Props = {
  open: boolean;
  onClose: () => void;
  provider: AiProvider;
  onProviderChange: (provider: AiProvider) => void;
};

export function SettingsDrawer({
  open,
  onClose,
  provider,
  onProviderChange,
}: Props) {
  const [localProvider, setLocalProvider] = useState(provider);

  useEffect(() => {
    if (open) setLocalProvider(provider);
  }, [open, provider]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <button
        type="button"
        className="h-full flex-1 cursor-default"
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-sm flex-col border-l border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <p className="text-sm font-semibold">Settings</p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Close
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto px-4 py-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Model provider
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Choose which engine generates architecture. Default is fine for
              most boards.
            </p>
            <div className="mt-3">
              <ProviderSwitcher
                value={localProvider}
                onChange={(p) => {
                  setLocalProvider(p);
                  onProviderChange(p);
                  saveSettings({ ...loadSettings(), provider: p });
                }}
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

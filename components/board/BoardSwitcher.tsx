"use client";

import { useState } from "react";
import type { BoardMeta } from "@/types/board";

type Props = {
  boards: BoardMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function BoardSwitcher({
  boards,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const active = boards.find((b) => b.id === activeId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="max-w-[180px] truncate rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-left text-xs font-medium hover:border-[var(--accent)]"
        title={active?.name || "Boards"}
      >
        {active?.name || "Boards"}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close board menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-[var(--line)] bg-[var(--panel)] p-2 shadow-lg">
            <button
              type="button"
              onClick={() => {
                onCreate();
                setOpen(false);
              }}
              className="mb-2 w-full rounded bg-[var(--ink)] px-2 py-1.5 text-xs font-medium text-[var(--panel)]"
            >
              New board
            </button>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {boards.map((board) => (
                <li
                  key={board.id}
                  className={`rounded border px-2 py-1.5 ${
                    board.id === activeId
                      ? "border-[var(--accent)] bg-[var(--accent-tint)]/40"
                      : "border-transparent hover:bg-[var(--bg)]"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full truncate text-left text-xs font-medium"
                    onClick={() => {
                      onSelect(board.id);
                      setOpen(false);
                    }}
                  >
                    {board.name}
                  </button>
                  <div className="mt-1 flex gap-2 text-[10px] text-[var(--muted)]">
                    <button
                      type="button"
                      onClick={() => {
                        const name = window.prompt("Rename board", board.name);
                        if (name) onRename(board.id, name);
                      }}
                    >
                      Rename
                    </button>
                    <button type="button" onClick={() => onDuplicate(board.id)}>
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="text-red-700"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete “${board.name}”? This cannot be undone.`,
                          )
                        ) {
                          onDelete(board.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

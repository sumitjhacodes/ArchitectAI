"use client";

import dynamic from "next/dynamic";

const BoardShell = dynamic(
  () =>
    import("@/components/board/BoardShell").then((mod) => mod.BoardShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh items-center justify-center bg-[var(--bg)] text-sm text-[var(--muted)]">
        Loading ArchitectAI…
      </div>
    ),
  },
);

export default function BoardPage() {
  return <BoardShell />;
}

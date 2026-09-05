"use client";

import dynamic from "next/dynamic";
import { ClientOnly } from "@/components/ClientOnly";

const BoardShell = dynamic(
  () =>
    import("@/components/board/BoardShell").then((mod) => mod.BoardShell),
  { ssr: false },
);

function BoardFallback() {
  return (
    <div className="flex h-dvh items-center justify-center bg-[var(--bg)] text-sm text-[var(--muted)]">
      Loading ArchitectAI…
    </div>
  );
}

export default function BoardPage() {
  return (
    <ClientOnly fallback={<BoardFallback />}>
      <BoardShell />
    </ClientOnly>
  );
}

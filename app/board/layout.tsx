import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Board — ArchitectAI",
};

export default function BoardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/excalidraw/index.css" />
      {children}
    </>
  );
}

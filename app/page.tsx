import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 h-[420px] w-[420px] rounded-full bg-[var(--accent-tint)] blur-3xl"
      />

      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          ArchitectAI
        </p>
        <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          Ask once. Get the full architecture on a whiteboard.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          Describe any project. ArchitectAI draws system diagrams, flows, and
          chaptered build steps — then you edit the board like Excalidraw.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/board"
            className="rounded-md bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-[var(--panel)]"
          >
            Open whiteboard
          </Link>
          <span className="text-xs text-[var(--muted)]">
            Free models · Gemini / Groq · local save
          </span>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Chat to blueprint",
              body: "Tell it what to build. It returns a typed architecture, not a vague essay.",
            },
            {
              title: "Draw & edit",
              body: "AI places frames, nodes, and arrows. You keep full Excalidraw control.",
            },
            {
              title: "Docs beside canvas",
              body: "Tech stack, commands, and steps stay synced with the diagrams.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="border border-[var(--line)] bg-[var(--panel)]/90 p-4"
            >
              <h2 className="text-sm font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function HomePage() {
  return (
    <main className="bg-[var(--bg)] text-[var(--ink)]">
      {/* Hero — one composition */}
      <section className="relative min-h-dvh overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage:
              "radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 75%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] bg-[radial-gradient(ellipse_at_70%_20%,var(--accent-tint),transparent_55%)]"
        />

        <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col justify-center gap-12 px-6 py-20 lg:flex-row lg:items-center lg:gap-16">
          <div className="max-w-xl shrink-0">
            <div className="mb-6 flex items-center gap-3">
              <Image
                src="/ArchitectAI.png"
                alt=""
                width={48}
                height={48}
                className="rounded-md"
                priority
              />
              <p className="font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
                ArchitectAI
              </p>
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl leading-[1.08] tracking-tight sm:text-5xl">
              Turn constraints into a reviewable architecture board.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--muted)] sm:text-lg">
              Before you write code, get system diagrams, flows, and chaptered
              build steps you can critique, refine, and export.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/board"
                className="rounded-md bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-[var(--panel)] transition-transform hover:scale-[1.02]"
              >
                Open whiteboard
              </Link>
              <a
                href="#what-it-does"
                className="text-sm text-[var(--muted)] underline-offset-4 hover:text-[var(--ink)] hover:underline"
              >
                How it works
              </a>
            </div>
            <p className="mt-5 max-w-sm border-l-2 border-[var(--accent)] pl-3 text-xs leading-relaxed text-[var(--muted)]">
              <span className="font-semibold text-[var(--accent)]">
                Early version.
              </span>{" "}
              Building toward one workspace: idea → architecture, flows, and
              the steps to ship.
            </p>
          </div>

          <div
            className="w-full max-w-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-none lg:ml-auto"
            aria-hidden
          >
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Example board
            </p>
            <div className="space-y-3">
              <BoardFrame title="System architecture">
                <Flow
                  nodes={["Client", "Next.js", "API", "Postgres"]}
                />
              </BoardFrame>
              <BoardFrame title="Auth flow">
                <Flow nodes={["Sign in", "Clerk", "Session", "Protected route"]} />
              </BoardFrame>
              <BoardFrame title="Chapter 1 · Setup">
                <p className="font-mono text-[11px] text-[var(--muted)]">
                  npx create-next-app · env · first deploy
                </p>
              </BoardFrame>
            </div>
          </div>
        </div>
      </section>

      {/* What it does */}
      <section
        id="what-it-does"
        className="border-t border-[var(--line)] px-6 py-20"
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
            What it does
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            ArchitectAI is a chat-driven whiteboard for software architecture.
            You write a plain request — stack preferences, constraints, product
            goal — and it returns a structured blueprint, then renders that
            blueprint as diagram frames on an Excalidraw canvas.
          </p>
          <ul className="mt-8 space-y-4 text-base leading-relaxed text-[var(--ink)]">
            <li className="border-l-2 border-[var(--accent)] pl-4">
              <span className="font-semibold">System diagrams</span>
              <span className="text-[var(--muted)]">
                {" "}
                — services, data stores, auth, and how requests move between
                them.
              </span>
            </li>
            <li className="border-l-2 border-[var(--accent)] pl-4">
              <span className="font-semibold">Flow and sequence views</span>
              <span className="text-[var(--muted)]">
                {" "}
                — upload pipelines, job runners, webhook paths, UI → API → DB.
              </span>
            </li>
            <li className="border-l-2 border-[var(--accent)] pl-4">
              <span className="font-semibold">Build chapters</span>
              <span className="text-[var(--muted)]">
                {" "}
                — ordered steps with concrete commands next to the matching
                diagram.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* How it helps */}
      <section className="border-t border-[var(--line)] bg-[var(--panel)] px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
            How it helps
          </h2>
          <div className="mt-8 space-y-8">
            <HelpBlock
              title="Start from a drawable plan, not a blank canvas"
              body="Instead of opening Excalidraw and inventing boxes from memory, you get a first-pass architecture you can critique and reshape in minutes."
            />
            <HelpBlock
              title="Keep the diagram and the build notes together"
              body="The canvas shows structure. The docs panel lists stack choices, chapter goals, and shell commands. You are not copy-pasting between a chat and a drawing tool."
            />
            <HelpBlock
              title="Refine the plan, then export it"
              body="Follow up to patch the architecture without wiping your board. Download Markdown, blueprint JSON, and Excalidraw when you are ready to share."
            />
            <HelpBlock
              title="Stay local while you iterate"
              body="Named boards autosave in your browser. No account required for the local workspace. Bring constraints (scale, stack, timeline) before you generate."
            />
          </div>
        </div>
      </section>

      {/* How you use it */}
      <section className="border-t border-[var(--line)] px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
            How you use it
          </h2>
          <ol className="mt-10 space-y-0">
            {[
              {
                n: "01",
                title: "Open a board",
                body: "Start a named board session. Create multiple projects and switch between them anytime.",
              },
              {
                n: "02",
                title: "Describe the product and constraints",
                body: "Example: “Auth + Postgres web app for an MVP in 6–10 weeks. Prefer Next.js. Avoid Kafka.”",
              },
              {
                n: "03",
                title: "Review, refine, export",
                body: "Chat streams the plan. Docs and the canvas update together. Check risks, refine in place, then download the plan package.",
              },
            ].map((step) => (
              <li
                key={step.n}
                className="grid grid-cols-[4rem_1fr] gap-4 border-t border-[var(--line)] py-6 last:border-b"
              >
                <span className="font-mono text-sm text-[var(--accent)]">
                  {step.n}
                </span>
                <div>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you should expect */}
      <section className="border-t border-[var(--line)] px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
            What you should expect
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            ArchitectAI designs and documents. It does not scaffold your repo,
            deploy your app, or invent proprietary APIs. Treat the output as a
            strong draft architecture for developers — then validate stack
            choices against your real constraints.
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <Expect
              label="Good for"
              items={[
                "Greenfield product architecture",
                "Explaining a system to collaborators",
                "Breaking a build into ordered chapters",
                "Iterating diagram + notes in one place",
              ]}
            />
            <Expect
              label="Not for"
              items={[
                "Generating production code end-to-end",
                "Realtime multiplayer whiteboarding",
                "Cloud sync or team accounts (MVP is local)",
                "Replacing domain review with an expert",
              ]}
            />
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-[var(--line)] px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
            Architect the next project on the board.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-[var(--muted)]">
            One prompt. Diagrams and steps you can edit. Start from the
            whiteboard.
          </p>
          <Link
            href="/board"
            className="mt-8 inline-block rounded-md bg-[var(--ink)] px-6 py-3 text-sm font-medium text-[var(--panel)] transition-transform hover:scale-[1.02]"
          >
            Open whiteboard
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--line)] px-6 py-6 text-center text-xs text-[var(--muted)]">
        ArchitectAI · first architecture before you build
      </footer>
    </main>
  );
}

function HelpBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
        {body}
      </p>
    </div>
  );
}

function Expect({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--ink)]">
        {items.map((item) => (
          <li key={item} className="border-b border-[var(--line)] pb-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoardFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-[var(--line)] bg-[var(--bg)] p-3">
      <p className="mb-2 text-xs font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Flow({ nodes }: { nodes: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {nodes.map((node, i) => (
        <span key={node} className="flex items-center gap-1.5">
          <span className="border border-[var(--ink)]/40 bg-[var(--panel)] px-2 py-1 text-[11px] font-medium">
            {node}
          </span>
          {i < nodes.length - 1 && (
            <span className="text-[10px] text-[var(--muted)]">→</span>
          )}
        </span>
      ))}
    </div>
  );
}

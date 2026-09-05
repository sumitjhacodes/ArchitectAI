# ArchitectAI

Agentic whiteboard: describe a project, get architecture diagrams on an Excalidraw canvas plus chaptered build docs (design → deploy).

## Setup

```bash
npm install
cp .env.example .env
```

Add at least one API key in `.env` (Gemini / Groq):

- `GOOGLE_GENERATIVE_AI_API_KEY`
- `GROQ_API_KEY`

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Open whiteboard**.

## Stack

- Next.js 16 · React 19 · Tailwind 4
- `@excalidraw/excalidraw`
- Vercel AI SDK · Zod blueprints · `localStorage` persistence

## Usage

1. Open the board (optionally switch engine A/B).
2. Ask e.g. “Build an AI job application agent with Next.js and Clerk — design through deploy”.
3. Chat streams the plan; Docs and the canvas update chapter by chapter.
4. Edit the board manually; refresh restores from local storage.

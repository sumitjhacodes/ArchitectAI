# ArchitectAI

Constraint-aware architecture boards: describe a product, get diagrams on Excalidraw plus chaptered build docs you can refine and export.

## Setup

```bash
npm install
cp .env.example .env
```

Add at least one API key in `.env`:

- `GOOGLE_GENERATIVE_AI_API_KEY`
- `GROQ_API_KEY`

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Open whiteboard**.

## Stack

- Next.js 16 · React 19 · Tailwind 4
- `@excalidraw/excalidraw`
- Vercel AI SDK · Zod blueprints · multi-board `localStorage` (+ optional durable `.data` store)

## Usage

1. Open a named board (create / switch / duplicate as needed).
2. Set constraints (scale, timeline, must-use / must-avoid).
3. Describe the product. Chat streams; Docs + canvas update chapter by chapter.
4. Use **Refine** to patch without wiping user drawings, or **Full redesign**.
5. **Download plan** for Markdown + blueprint JSON + `.excalidraw`.

## Scripts

```bash
npm run test
npm run build
```

Deploy on Vercel: set env vars and note `maxDuration` 180s for `/api/architect` (see `vercel.json`).

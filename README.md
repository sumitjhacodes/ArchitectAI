# ArchitectAI

Agentic whiteboard: describe a project, get architecture diagrams on an Excalidraw canvas plus chaptered build docs.

## Setup

```bash
npm install
cp .env.example .env.local
```

Add at least one free API key in `.env.local`:

- `GOOGLE_GENERATIVE_AI_API_KEY` — [Google AI Studio](https://aistudio.google.com/apikey)
- `GROQ_API_KEY` — [Groq Console](https://console.groq.com/keys)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Open whiteboard**.

## Stack

- Next.js 16 · React 19 · Tailwind 4
- `@excalidraw/excalidraw`
- Vercel AI SDK (`ai`) + Gemini / Groq
- Zod blueprints · `localStorage` persistence

## Usage

1. Pick **Gemini** or **Groq** in the chat sidebar.
2. Ask e.g. “Build an AI job application agent with Next.js and Clerk”.
3. ArchitectAI fills the canvas (frames, nodes, arrows) and the Docs panel.
4. Edit the board manually like Excalidraw; refresh restores from local storage.

import { generateObject, generateText, streamText } from "ai";
import { ARCHITECT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { buildArchitectUserPrompt } from "@/lib/ai/user-prompt";
import { getArchitectModel } from "@/lib/ai/providers";
import {
  architectureBlueprintSchema,
  type ArchitectureBlueprint,
  type BlueprintChapter,
} from "@/lib/architecture/schema";
import {
  blueprintOutlineSchema,
  singleChapterSchema,
  type BlueprintOutline,
} from "@/lib/architecture/outline-schema";
import type { AiProvider } from "@/types/board";

export const maxDuration = 180;

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type StreamEvent =
  | { type: "narration"; delta: string }
  | { type: "status"; message: string }
  | {
      type: "meta";
      projectName: string;
      summary: string;
      techStack: ArchitectureBlueprint["techStack"];
      assumptions: string[];
      tradeOffs: ArchitectureBlueprint["tradeOffs"];
      risks: ArchitectureBlueprint["risks"];
    }
  | {
      type: "chapter";
      index: number;
      total: number;
      chapter: BlueprintChapter;
      projectName: string;
      summary: string;
      techStack: ArchitectureBlueprint["techStack"];
      assumptions: string[];
      tradeOffs: ArchitectureBlueprint["tradeOffs"];
      risks: ArchitectureBlueprint["risks"];
    }
  | {
      type: "complete";
      narration: string;
      blueprint: ArchitectureBlueprint;
    }
  | { type: "error"; error: string };

function normalizeChapter(
  chapter: BlueprintChapter,
  index: number,
): BlueprintChapter {
  return {
    ...chapter,
    id: chapter.id || `chapter-${index + 1}`,
    steps: (chapter.steps ?? []).map((s, si) => ({
      ...s,
      n: s.n || si + 1,
      commands: s.commands ?? [],
    })),
    diagram: {
      type: chapter.diagram?.type ?? "system",
      nodes: (chapter.diagram?.nodes ?? []).slice(0, 7).map((n) => ({
        ...n,
        group: n.group || "2-app",
        kind: n.kind || "other",
        label: (n.label || n.id).slice(0, 18),
      })),
      edges: (chapter.diagram?.edges ?? []).map((e) => ({
        ...e,
        label: e.label ?? "",
      })),
    },
  };
}

async function generateOutline(
  model: ReturnType<typeof getArchitectModel>,
  system: string,
  prompt: string,
): Promise<BlueprintOutline> {
  try {
    const { object } = await generateObject({
      model,
      schema: blueprintOutlineSchema,
      schemaName: "BlueprintOutline",
      system,
      prompt,
    });
    return object;
  } catch {
    const { text } = await generateText({
      model,
      system: `${system}\n\nReturn ONLY JSON for the outline schema. No markdown.`,
      prompt,
    });
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = blueprintOutlineSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      throw new Error("Could not build architecture outline. Try again.");
    }
    return parsed.data;
  }
}

async function generateChapter(
  model: ReturnType<typeof getArchitectModel>,
  system: string,
  prompt: string,
): Promise<BlueprintChapter> {
  try {
    const { object } = await generateObject({
      model,
      schema: singleChapterSchema,
      schemaName: "SingleChapter",
      system,
      prompt,
    });
    return object.chapter;
  } catch {
    const { text } = await generateText({
      model,
      system: `${system}\n\nReturn ONLY JSON: { "chapter": { ... } }. No markdown.`,
      prompt,
    });
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = singleChapterSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      throw new Error("Could not generate a chapter. Try again.");
    }
    return parsed.data.chapter;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      provider?: AiProvider;
      messages?: IncomingMessage[];
      blueprint?: unknown;
    };

    const provider: AiProvider =
      body.provider === "groq" ? "groq" : "gemini";
    const messages = body.messages ?? [];

    if (!messages.length) {
      return Response.json(
        { error: "At least one message is required." },
        { status: 400 },
      );
    }

    const model = getArchitectModel(provider);
    const lastUser =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    let existingNote = "";
    if (body.blueprint) {
      const parsed = architectureBlueprintSchema.safeParse(body.blueprint);
      if (parsed.success) {
        existingNote = `\n\nRefine existing project "${parsed.data.projectName}". Prior chapters: ${parsed.data.chapters.map((c) => c.title).join("; ")}.`;
      }
    }

    const userPrompt = buildArchitectUserPrompt(lastUser);
    const history = messages
      .slice(0, -1)
      .slice(-6)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        };

        try {
          // 1) ChatGPT-style narration stream
          const narrationStream = streamText({
            model,
            system:
              ARCHITECT_SYSTEM_PROMPT +
              existingNote +
              "\n\nWrite ONLY the chat narration now (4–8 short paragraphs). No JSON. No vendor/model names.",
            prompt: `${history ? `Conversation so far:\n${history}\n\n` : ""}${userPrompt}\n\nNarration only.`,
          });

          let narration = "";
          for await (const delta of narrationStream.textStream) {
            narration += delta;
            send({ type: "narration", delta });
          }

          send({ type: "status", message: "Structuring the build plan…" });

          // 2) Outline (stack + chapter titles)
          const outline = await generateOutline(
            model,
            ARCHITECT_SYSTEM_PROMPT + existingNote,
            `${userPrompt}\n\nNarration:\n${narration.slice(0, 1500)}\n\nProduce the outline with 5–7 chapterTitles covering system, frontend, backend, database, core flow, setup, deploy.`,
          );

          const titles = (outline.chapterTitles ?? []).slice(0, 7);
          if (titles.length < 4) {
            titles.push(
              "System overview",
              "Frontend",
              "Backend API",
              "Database",
              "Local setup & deploy",
            );
          }

          send({
            type: "meta",
            projectName: outline.projectName,
            summary: outline.summary,
            techStack: outline.techStack,
            assumptions: outline.assumptions,
            tradeOffs: outline.tradeOffs,
            risks: outline.risks,
          });

          const chapters: BlueprintChapter[] = [];
          const total = titles.length;

          // 3) Each chapter → docs + whiteboard update live
          for (let i = 0; i < total; i++) {
            send({
              type: "status",
              message: `Writing chapter ${i + 1}/${total}: ${titles[i]}…`,
            });

            const rawChapter = await generateChapter(
              model,
              ARCHITECT_SYSTEM_PROMPT + existingNote,
              `${userPrompt}

Project: ${outline.projectName}
Summary: ${outline.summary}
Stack: ${outline.techStack.map((t) => t.name).join(", ")}
Chapter ${i + 1} of ${total} title: "${titles[i]}"
Previous chapters: ${chapters.map((c) => c.title).join(" | ") || "(none)"}

Produce THIS chapter only: 5–8 executable steps, one clean layered diagram (3–7 nodes).`,
            );

            const chapter = normalizeChapter(rawChapter, i);
            chapters.push(chapter);

            send({
              type: "chapter",
              index: i,
              total,
              chapter,
              projectName: outline.projectName,
              summary: outline.summary,
              techStack: outline.techStack,
              assumptions: outline.assumptions,
              tradeOffs: outline.tradeOffs,
              risks: outline.risks,
            });
          }

          const blueprint: ArchitectureBlueprint = {
            projectName: outline.projectName,
            summary: outline.summary,
            assumptions: outline.assumptions?.length
              ? outline.assumptions
              : ["Assumptions inferred from the request."],
            techStack: outline.techStack,
            chapters,
            tradeOffs: outline.tradeOffs ?? [],
            risks: outline.risks ?? [],
          };

          send({
            type: "complete",
            narration:
              narration.trim() ||
              `Architecture plan ready for ${blueprint.projectName}.`,
            blueprint,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to generate architecture";
          send({ type: "error", error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate architecture";
    const status = message.includes("API_KEY") || message.includes("configured")
      ? 400
      : 500;
    return Response.json({ error: message }, { status });
  }
}

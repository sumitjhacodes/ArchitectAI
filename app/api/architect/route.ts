import { generateObject, generateText, streamText } from "ai";
import { ARCHITECT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { buildArchitectUserPrompt } from "@/lib/ai/user-prompt";
import {
  getArchitectModel,
  getStructuredModel,
} from "@/lib/ai/providers";
import { parseModelJson } from "@/lib/ai/parse-json";
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
import { normalizeOutline } from "@/lib/architecture/normalize-outline";
import { normalizeChapterRaw } from "@/lib/architecture/normalize-chapter";
import {
  createGenerationRun,
  updateGenerationRun,
} from "@/lib/db/boards";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";
import type { AiProvider } from "@/types/board";

export const maxDuration = 180;

const MAX_OUTPUT_TOKENS = 6144;

/** Short system for structured JSON — still demands engineer-grade content. */
const STRUCTURED_JSON_SYSTEM = `You are ArchitectAI producing structured architecture JSON.
Reply with valid JSON only. No markdown fences. No prose before/after JSON.
diagram.type must be one of: system, flow, sequence, erd, wireframe.
step.n must be a number. commands must be a string array (use [] if none).
Content quality: concrete file paths, routes, table names, env vars, CLI commands.
No TBD or vague steps. Prefer the simplest stack that meets constraints.
Keep strings tight but specific — never empty placeholders.`;

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
      failedChapters?: string[];
    }
  | { type: "chapter_failed"; title: string; error: string }
  | { type: "error"; error: string };

function polishChapter(
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

function outlineFromUnknown(raw: unknown): BlueprintOutline {
  const normalized = normalizeOutline(raw);
  const parsed = blueprintOutlineSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error("Could not build architecture outline. Try again.");
  }
  return parsed.data;
}

function chapterFromUnknown(
  raw: unknown,
  index: number,
  fallbackTitle: string,
): BlueprintChapter {
  return polishChapter(normalizeChapterRaw(raw, index, fallbackTitle), index);
}

function extractErrorText(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { text?: unknown; cause?: unknown };
  if (typeof e.text === "string" && e.text.trim()) return e.text;
  const cause = e.cause as { text?: unknown } | undefined;
  if (cause && typeof cause.text === "string" && cause.text.trim()) {
    return cause.text;
  }
  return null;
}

type StructuredModel = ReturnType<typeof getStructuredModel>;

async function generateOutline(
  model: StructuredModel,
  prompt: string,
): Promise<BlueprintOutline> {
  try {
    const { object } = await generateObject({
      model,
      schema: blueprintOutlineSchema,
      schemaName: "BlueprintOutline",
      system: STRUCTURED_JSON_SYSTEM,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    return outlineFromUnknown(object);
  } catch (error) {
    const salvaged = extractErrorText(error);
    if (salvaged) {
      try {
        return outlineFromUnknown(parseModelJson(salvaged));
      } catch {
        // fall through
      }
    }

    const { text } = await generateText({
      model,
      system: STRUCTURED_JSON_SYSTEM,
      prompt: `${prompt}

Return ONE JSON object with keys:
projectName, summary, assumptions[], techStack[{name,role,category}],
chapterTitles[], tradeOffs[{decision,alternatives,pros,cons,riskMitigation}],
risks[{risk,severity,probability,mitigation}].`,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    return outlineFromUnknown(parseModelJson(text));
  }
}

async function generateChapter(
  model: StructuredModel,
  prompt: string,
  index: number,
  fallbackTitle: string,
): Promise<BlueprintChapter> {
  try {
    const { object } = await generateObject({
      model,
      schema: singleChapterSchema,
      schemaName: "SingleChapter",
      system: STRUCTURED_JSON_SYSTEM,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    return chapterFromUnknown(object, index, fallbackTitle);
  } catch (error) {
    const salvaged = extractErrorText(error);
    if (salvaged) {
      try {
        return chapterFromUnknown(parseModelJson(salvaged), index, fallbackTitle);
      } catch {
        // fall through
      }
    }

    try {
      const { text } = await generateText({
        model,
        system: STRUCTURED_JSON_SYSTEM,
        prompt: `${prompt}

Return ONE JSON object shaped like:
{"chapter":{"id":"c1","title":"${fallbackTitle}","goal":"...","steps":[{"n":1,"title":"...","detail":"...","commands":[]}],"diagram":{"type":"system","nodes":[{"id":"a","label":"A","kind":"service","group":"2-app"}],"edges":[{"from":"a","to":"b","label":""}]}}}`,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      return chapterFromUnknown(parseModelJson(text), index, fallbackTitle);
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `Chapter "${fallbackTitle}" failed: ${err.message}`
          : `Chapter "${fallbackTitle}" failed`,
      );
    }
  }
}

export async function POST(request: Request) {
  try {
    const ip = clientKeyFromRequest(request);
    const minute = rateLimit(`architect:min:${ip}`, 8, 60_000);
    if (!minute.ok) {
      return Response.json(
        { error: "Rate limit exceeded. Wait a minute and try again." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(minute.resetAt),
          },
        },
      );
    }
    const daily = rateLimit(`architect:day:${ip}`, 40, 24 * 60 * 60 * 1000);
    if (!daily.ok) {
      return Response.json(
        { error: "Daily generation cap reached for this network." },
        { status: 429 },
      );
    }

    const body = (await request.json()) as {
      provider?: AiProvider;
      messages?: IncomingMessage[];
      blueprint?: unknown;
      mode?: "full" | "patch";
      refineAction?: "challenge-stack" | "tighten-mvp" | "patch";
      constraints?: {
        scale?: string;
        timeline?: string;
        preferredTech?: string[];
        avoidTech?: string[];
      };
      retryChapterTitle?: string;
    };

    const provider: AiProvider =
      body.provider === "groq" ? "groq" : "gemini";
    const messages = body.messages ?? [];
    const mode = body.mode === "patch" ? "patch" : "full";

    if (!messages.length) {
      return Response.json(
        { error: "At least one message is required." },
        { status: 400 },
      );
    }

    const model = getArchitectModel(provider);
    const structuredModel = getStructuredModel(provider);
    const lastUser =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    let existingNote = "";
    let existingBlueprint: ArchitectureBlueprint | null = null;
    if (body.blueprint) {
      const parsed = architectureBlueprintSchema.safeParse(body.blueprint);
      if (parsed.success) {
        existingBlueprint = parsed.data;
        existingNote = `\n\nRefine existing project "${parsed.data.projectName}". Prior chapters: ${parsed.data.chapters.map((c) => c.title).join("; ")}. Mode: ${mode}.`;
      }
    }

    const userPrompt = buildArchitectUserPrompt(lastUser, {
      scale: body.constraints?.scale,
      timeline: body.constraints?.timeline,
      preferredTech: body.constraints?.preferredTech,
      avoidTech: body.constraints?.avoidTech,
      mode,
      refineAction: body.refineAction,
    });
    const history = messages
      .slice(0, -1)
      .slice(-6)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const encoder = new TextEncoder();
    const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    void createGenerationRun({
      id: runId,
      userId: ip,
      status: "started",
    });

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        };

        try {
          // Single-chapter retry path
          if (body.retryChapterTitle && existingBlueprint) {
            send({
              type: "status",
              message: `Retrying chapter: ${body.retryChapterTitle}…`,
            });
            const idx = existingBlueprint.chapters.findIndex(
              (c) => c.title === body.retryChapterTitle,
            );
            const chapter = await generateChapter(
              structuredModel,
              `${userPrompt}

Project: ${existingBlueprint.projectName}
Summary: ${existingBlueprint.summary}
Stack: ${existingBlueprint.techStack.map((t) => t.name).join(", ")}
Retry chapter title: "${body.retryChapterTitle}"
${existingNote}

Produce THIS chapter only with executable steps and a clean layered diagram.`,
              Math.max(0, idx),
              body.retryChapterTitle,
            );
            const chapters = [...existingBlueprint.chapters];
            if (idx >= 0) chapters[idx] = chapter;
            else chapters.push(chapter);
            const blueprint: ArchitectureBlueprint = {
              ...existingBlueprint,
              chapters,
            };
            send({
              type: "chapter",
              index: Math.max(0, idx),
              total: chapters.length,
              chapter,
              projectName: blueprint.projectName,
              summary: blueprint.summary,
              techStack: blueprint.techStack,
              assumptions: blueprint.assumptions,
              tradeOffs: blueprint.tradeOffs,
              risks: blueprint.risks,
            });
            send({
              type: "complete",
              narration: `Updated chapter “${body.retryChapterTitle}”.`,
              blueprint,
              failedChapters: [],
            });
            return;
          }

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

          const outlineBudget =
            provider === "groq"
              ? "Produce 5–6 chapterTitles covering system, frontend, backend, database, core flow, setup/deploy. Keep each assumption/trade-off/risk to 1–2 precise sentences."
              : "Produce the outline with 5–7 chapterTitles covering system, frontend, backend, database, core flow, setup, deploy. Be specific in assumptions, trade-offs, and risks.";

          const outline = await generateOutline(
            structuredModel,
            `${userPrompt}\n\nNarration:\n${narration.slice(0, provider === "groq" ? 1200 : 1800)}\n\n${outlineBudget}${existingNote}`,
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
          const failedChapters: string[] = [];
          const total = titles.length;

          for (let i = 0; i < total; i++) {
            send({
              type: "status",
              message: `Writing chapter ${i + 1}/${total}: ${titles[i]}…`,
            });

            const chapterBudget =
              provider === "groq"
                ? "Produce THIS chapter only: 5–7 executable steps with real paths/commands, one layered diagram (4–6 nodes, short labels). No vague steps."
                : "Produce THIS chapter only: 5–8 executable steps with file paths, routes, schema names, and commands; one clean layered diagram (3–7 nodes).";

            try {
              const chapter = await generateChapter(
                structuredModel,
                `${userPrompt}

Project: ${outline.projectName}
Summary: ${outline.summary}
Stack: ${outline.techStack.map((t) => t.name).join(", ")}
Chapter ${i + 1} of ${total} title: "${titles[i]}"
Previous chapters: ${chapters.map((c) => c.title).join(" | ") || "(none)"}
${existingNote}

${chapterBudget}`,
                i,
                titles[i] || `Chapter ${i + 1}`,
              );
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
            } catch (chapterError) {
              const msg =
                chapterError instanceof Error
                  ? chapterError.message
                  : "Chapter failed";
              failedChapters.push(titles[i]);
              send({
                type: "chapter_failed",
                title: titles[i],
                error: msg,
              });
            }
          }

          if (!chapters.length) {
            throw new Error(
              "No chapters could be generated. Try again or switch provider in Settings.",
            );
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
            failedChapters,
          });
          void updateGenerationRun(runId, { status: "completed" });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to generate architecture";
          void updateGenerationRun(runId, {
            status: "failed",
            error: message,
          });
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

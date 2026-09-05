import { generateObject } from "ai";
import { ARCHITECT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { getArchitectModel } from "@/lib/ai/providers";
import {
  architectResponseSchema,
  architectureBlueprintSchema,
} from "@/lib/architecture/schema";
import type { AiProvider } from "@/types/board";

export const maxDuration = 60;

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

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

    let existingBlueprintNote = "";
    if (body.blueprint) {
      const parsed = architectureBlueprintSchema.safeParse(body.blueprint);
      if (parsed.success) {
        existingBlueprintNote = `\n\nExisting blueprint JSON to refine:\n${JSON.stringify(parsed.data)}`;
      }
    }

    const { object } = await generateObject({
      model,
      schema: architectResponseSchema,
      schemaName: "ArchitectAIBlueprint",
      schemaDescription:
        "Narration plus a full architecture blueprint for the whiteboard",
      system: ARCHITECT_SYSTEM_PROMPT + existingBlueprintNote,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return Response.json(object);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate architecture";
    const status = message.includes("API_KEY") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}

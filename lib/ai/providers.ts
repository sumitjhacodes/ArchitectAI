import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import type { AiProvider } from "@/types/board";

export function getArchitectModel(provider: AiProvider) {
  if (provider === "groq") {
    if (!process.env.GROQ_API_KEY) {
      throw new Error(
        "Engine B is not configured. Add GROQ_API_KEY to your .env file.",
      );
    }
    return groq("openai/gpt-oss-120b");
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      "Engine A is not configured. Add GOOGLE_GENERATIVE_AI_API_KEY to your .env file.",
    );
  }

  return google("gemini-3.6-flash");
}

export function providerLabel(provider: AiProvider) {
  return provider === "groq" ? "Engine B" : "Engine A";
}

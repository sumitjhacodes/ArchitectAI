import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import type { AiProvider } from "@/types/board";

/** Chat narration model (can be larger / more verbose). */
export function getArchitectModel(provider: AiProvider) {
  if (provider === "groq") {
    if (!process.env.GROQ_API_KEY) {
      throw new Error(
        "Groq is not configured. Add GROQ_API_KEY to your .env file.",
      );
    }
    return groq("openai/gpt-oss-120b");
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      "Gemini is not configured. Add GOOGLE_GENERATIVE_AI_API_KEY to your .env file.",
    );
  }

  return google("gemini-3.6-flash");
}

/**
 * Structured JSON (outline/chapters). On Groq, use a smaller OSS model so
 * JSON finishes reliably after a heavy narration call on 120B.
 */
export function getStructuredModel(provider: AiProvider) {
  if (provider === "groq") {
    if (!process.env.GROQ_API_KEY) {
      throw new Error(
        "Groq is not configured. Add GROQ_API_KEY to your .env file.",
      );
    }
    return groq("openai/gpt-oss-20b");
  }
  return getArchitectModel(provider);
}

export function providerLabel(provider: AiProvider) {
  return provider === "groq" ? "Groq" : "Gemini";
}

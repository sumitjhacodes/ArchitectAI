import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import type { AiProvider } from "@/types/board";

export function getArchitectModel(provider: AiProvider) {
  if (provider === "groq") {
    if (!process.env.GROQ_API_KEY) {
      throw new Error(
        "GROQ_API_KEY is missing. Add it to .env.local or switch to Gemini.",
      );
    }
    return groq("llama-3.3-70b-versatile");
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY is missing. Add it to .env.local or switch to Groq.",
    );
  }

  return google("gemini-2.5-flash");
}

export function providerLabel(provider: AiProvider) {
  return provider === "groq" ? "Groq Llama 3.3" : "Gemini 2.5 Flash";
}

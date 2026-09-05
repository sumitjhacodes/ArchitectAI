import { jsonrepair } from "jsonrepair";

/** Pull the first JSON object/array out of a model response. */
export function extractJsonText(raw: string): string {
  let text = raw.trim();
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  let start = -1;
  if (objectStart >= 0 && arrayStart >= 0) start = Math.min(objectStart, arrayStart);
  else start = Math.max(objectStart, arrayStart);

  if (start < 0) return text;
  return text.slice(start);
}

/** Parse model JSON; repair truncated/malformed payloads when needed. */
export function parseModelJson<T = unknown>(raw: string): T {
  const extracted = extractJsonText(raw);

  try {
    return JSON.parse(extracted) as T;
  } catch {
    try {
      return JSON.parse(jsonrepair(extracted)) as T;
    } catch {
      throw new Error(
        "Model returned incomplete JSON. Try again or switch provider.",
      );
    }
  }
}

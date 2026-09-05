import { z } from "zod";

/**
 * Keep this schema Gemini/Groq-friendly: avoid .min/.max/.int/.positive
 * (those often become JSON-schema constraints providers reject as invalid args).
 */

export const techStackItemSchema = z.object({
  name: z.string(),
  role: z.string(),
  category: z.string(),
});

export const stepSchema = z.object({
  n: z.number(),
  title: z.string(),
  detail: z.string(),
  commands: z.array(z.string()),
});

export const diagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.string(),
  group: z.string(),
});

export const diagramEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string(),
});

export const diagramSchema = z.object({
  type: z.enum(["system", "flow", "sequence", "erd", "wireframe"]),
  nodes: z.array(diagramNodeSchema),
  edges: z.array(diagramEdgeSchema),
});

export const chapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  goal: z.string(),
  steps: z.array(stepSchema),
  diagram: diagramSchema,
});

export const tradeOffSchema = z.object({
  decision: z.string(),
  alternatives: z.array(z.string()),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  riskMitigation: z.string(),
});

export const riskSchema = z.object({
  risk: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  probability: z.enum(["high", "medium", "low"]),
  mitigation: z.string(),
});

export const architectureBlueprintSchema = z.object({
  projectName: z.string(),
  summary: z.string(),
  assumptions: z.array(z.string()),
  techStack: z.array(techStackItemSchema),
  chapters: z.array(chapterSchema),
  tradeOffs: z.array(tradeOffSchema),
  risks: z.array(riskSchema),
});

/** Blueprint-only schema for the structured call (narration streamed separately). */
export const architectResponseSchema = z.object({
  narration: z.string(),
  blueprint: architectureBlueprintSchema,
});

export type ArchitectureBlueprint = z.infer<typeof architectureBlueprintSchema>;
export type ArchitectResponse = z.infer<typeof architectResponseSchema>;
export type BlueprintChapter = z.infer<typeof chapterSchema>;

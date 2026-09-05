import { z } from "zod";

export const techStackItemSchema = z.object({
  name: z.string().describe("Technology name, e.g. Next.js"),
  role: z.string().describe("How it is used in the project"),
  category: z
    .string()
    .describe("Category such as frontend, backend, database, auth, ai"),
});

export const stepSchema = z.object({
  n: z.number().int().positive(),
  title: z.string(),
  detail: z.string(),
  commands: z
    .array(z.string())
    .optional()
    .describe("Shell or CLI commands when relevant"),
});

export const diagramNodeSchema = z.object({
  id: z.string().describe("Stable id used by edges, e.g. nextjs-app"),
  label: z.string(),
  kind: z
    .string()
    .describe(
      "client | app | api | service | db | ai | auth | storage | queue | step | other",
    ),
  group: z.string().optional(),
});

export const diagramEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});

export const diagramSchema = z.object({
  type: z.enum(["system", "flow", "sequence", "erd", "wireframe"]),
  nodes: z.array(diagramNodeSchema).min(1),
  edges: z.array(diagramEdgeSchema),
});

export const chapterSchema = z.object({
  id: z.string(),
  title: z.string().describe('e.g. "Chapter 1: Project Setup"'),
  goal: z.string(),
  steps: z.array(stepSchema).min(1),
  diagram: diagramSchema,
});

export const architectureBlueprintSchema = z.object({
  projectName: z.string(),
  summary: z.string(),
  techStack: z.array(techStackItemSchema).min(1),
  chapters: z
    .array(chapterSchema)
    .min(2)
    .max(8)
    .describe("Ordered implementation chapters with diagrams"),
});

export const architectResponseSchema = z.object({
  narration: z
    .string()
    .describe(
      "Short chat reply summarizing what was drawn and how to proceed",
    ),
  blueprint: architectureBlueprintSchema,
});

export type ArchitectureBlueprint = z.infer<typeof architectureBlueprintSchema>;
export type ArchitectResponse = z.infer<typeof architectResponseSchema>;
export type BlueprintChapter = z.infer<typeof chapterSchema>;

import { z } from "zod";
import {
  architectureBlueprintSchema,
  chapterSchema,
  type ArchitectureBlueprint,
  type BlueprintChapter,
} from "@/lib/architecture/schema";

/** Lightweight outline before chapter-by-chapter generation. */
export const blueprintOutlineSchema = z.object({
  projectName: z.string(),
  summary: z.string(),
  assumptions: z.array(z.string()),
  techStack: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      category: z.string(),
    }),
  ),
  chapterTitles: z.array(z.string()),
  tradeOffs: z.array(
    z.object({
      decision: z.string(),
      alternatives: z.array(z.string()),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
      riskMitigation: z.string(),
    }),
  ),
  risks: z.array(
    z.object({
      risk: z.string(),
      severity: z.enum(["high", "medium", "low"]),
      probability: z.enum(["high", "medium", "low"]),
      mitigation: z.string(),
    }),
  ),
});

export type BlueprintOutline = z.infer<typeof blueprintOutlineSchema>;

export const singleChapterSchema = z.object({
  chapter: chapterSchema,
});

export {
  architectureBlueprintSchema,
  type ArchitectureBlueprint,
  type BlueprintChapter,
};

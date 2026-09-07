/**
 * Build the final user turn for ArchitectAI (full build path).
 */
export type ArchitectPromptContext = {
  teamSize?: number;
  budget?: string;
  timeline?: string;
  preferredTech?: string[];
  avoidTech?: string[];
  scale?: string;
  mode?: "full" | "patch";
  refineAction?: "challenge-stack" | "tighten-mvp" | "patch";
};

export function buildArchitectUserPrompt(
  userInput: string,
  context?: ArchitectPromptContext,
) {
  const lines = [
    "## PROJECT REQUEST",
    `"${userInput.trim()}"`,
    "",
    "## CONTEXT",
  ];

  const contextLines: string[] = [];
  if (context?.teamSize) {
    contextLines.push(`- Team size: ${context.teamSize} engineers`);
  }
  if (context?.budget) contextLines.push(`- Budget: ${context.budget}`);
  if (context?.timeline) contextLines.push(`- Timeline: ${context.timeline}`);
  if (context?.preferredTech?.length) {
    contextLines.push(`- Must use / prefer: ${context.preferredTech.join(", ")}`);
  }
  if (context?.avoidTech?.length) {
    contextLines.push(`- Must avoid: ${context.avoidTech.join(", ")}`);
  }
  if (context?.scale) contextLines.push(`- Expected scale: ${context.scale}`);
  if (context?.mode === "patch") {
    contextLines.push(
      "- Mode: PATCH — update only what the user asked; keep the rest of the blueprint stable.",
    );
  }
  if (context?.refineAction === "challenge-stack") {
    contextLines.push(
      "- Action: Challenge the current stack. Prefer simpler, cheaper, or more proven alternatives where justified.",
    );
  }
  if (context?.refineAction === "tighten-mvp") {
    contextLines.push(
      "- Action: Tighten for MVP. Cut non-essential services; keep a shippable path in 4–8 weeks.",
    );
  }

  lines.push(
    contextLines.length
      ? contextLines.join("\n")
      : "- None provided — assume a small product team shipping an MVP in 6–10 weeks. State assumptions.",
  );

  lines.push(
    "",
    "## DELIVERABLE REQUIREMENTS",
    "1. Full path: architecture → frontend → backend → database → core flow → local setup → deploy/ops.",
    "2. 5–7 chapters; each with 5–8 executable steps (paths, commands, schema/route names).",
    "3. Diagrams: 3–7 nodes, layered groups, no overlap, left-to-right edges.",
    "4. Concrete tech stack with versions where possible; justify any complexity beyond MVP.",
    "5. Explicit assumptions, trade-offs, and launch risks.",
    "6. Quality bar: a working engineer should trust this enough to open an IDE and start.",
    "7. Call out what is deferred out of MVP.",
  );

  return lines.join("\n");
}

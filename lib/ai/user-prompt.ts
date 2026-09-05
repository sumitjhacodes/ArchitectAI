/**
 * Build the final user turn for ArchitectAI (full build path).
 */
export function buildArchitectUserPrompt(
  userInput: string,
  context?: {
    teamSize?: number;
    budget?: string;
    timeline?: string;
    preferredTech?: string[];
    scale?: string;
  },
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
    contextLines.push(`- Preferred tech: ${context.preferredTech.join(", ")}`);
  }
  if (context?.scale) contextLines.push(`- Expected scale: ${context.scale}`);

  lines.push(
    contextLines.length
      ? contextLines.join("\n")
      : "- None provided — assume a small product team shipping an MVP in 6–10 weeks. State assumptions.",
  );

  lines.push(
    "",
    "## DELIVERABLE REQUIREMENTS",
    "1. Full path: architecture → frontend → backend → database → core flow → local setup → deploy/ops.",
    "2. 5–7 chapters; each with 5–8 executable steps (paths, commands, schema names).",
    "3. Diagrams: 3–7 nodes, layered groups, no overlap, left-to-right edges.",
    "4. Concrete tech stack with versions where possible.",
    "5. Include assumptions, trade-offs, and risks.",
    "6. Quality bar: something a working engineer would trust to start building today.",
  );

  return lines.join("\n");
}

import type { BlueprintOutline } from "@/lib/architecture/outline-schema";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function asLevel(value: unknown): "high" | "medium" | "low" {
  const raw = asString(value, "medium").toLowerCase();
  if (raw.includes("high") || raw === "h" || raw === "critical") return "high";
  if (raw.includes("low") || raw === "l") return "low";
  return "medium";
}

/** Coerce messy model JSON into a schema-safe outline. */
export function normalizeOutline(raw: unknown): BlueprintOutline {
  const o =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  // Some models nest under outline / blueprint
  const nested =
    (o.outline && typeof o.outline === "object" ? o.outline : null) ??
    (o.blueprint && typeof o.blueprint === "object" ? o.blueprint : null);
  const src = (nested ?? o) as Record<string, unknown>;

  const techStack = Array.isArray(src.techStack)
    ? src.techStack
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const t = item as Record<string, unknown>;
          const name = asString(t.name || t.tech || t.technology);
          if (!name) return null;
          return {
            name,
            role: asString(t.role || t.purpose, "core"),
            category: asString(t.category || t.layer, "other"),
          };
        })
        .filter((t): t is { name: string; role: string; category: string } => !!t)
    : [];

  const chapterTitles = asStringArray(
    src.chapterTitles ?? src.chapters ?? src.titles,
  ).map((title) => {
    // chapters may be objects
    return title;
  });

  const titlesFromObjects = Array.isArray(src.chapters)
    ? src.chapters
        .map((c) => {
          if (typeof c === "string") return c;
          if (c && typeof c === "object") {
            return asString((c as Record<string, unknown>).title);
          }
          return "";
        })
        .filter(Boolean)
    : [];

  const tradeOffs = Array.isArray(src.tradeOffs)
    ? src.tradeOffs
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const t = item as Record<string, unknown>;
          const decision = asString(t.decision || t.choice || t.title);
          if (!decision) return null;
          return {
            decision,
            alternatives: asStringArray(t.alternatives),
            pros: asStringArray(t.pros),
            cons: asStringArray(t.cons),
            riskMitigation: asString(
              t.riskMitigation || t.mitigation || t.notes,
              "Monitor and revisit if needed.",
            ),
          };
        })
        .filter(
          (
            t,
          ): t is {
            decision: string;
            alternatives: string[];
            pros: string[];
            cons: string[];
            riskMitigation: string;
          } => !!t,
        )
    : [];

  const risks = Array.isArray(src.risks)
    ? src.risks
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const r = item as Record<string, unknown>;
          const risk = asString(r.risk || r.title || r.name);
          if (!risk) return null;
          return {
            risk,
            severity: asLevel(r.severity),
            probability: asLevel(r.probability || r.likelihood),
            mitigation: asString(r.mitigation || r.riskMitigation, "Track closely."),
          };
        })
        .filter(
          (
            r,
          ): r is {
            risk: string;
            severity: "high" | "medium" | "low";
            probability: "high" | "medium" | "low";
            mitigation: string;
          } => !!r,
        )
    : [];

  const titles = (chapterTitles.length ? chapterTitles : titlesFromObjects).slice(
    0,
    7,
  );

  return {
    projectName: asString(src.projectName || src.name, "Untitled Project"),
    summary: asString(src.summary || src.description, "Architecture outline."),
    assumptions: asStringArray(src.assumptions).length
      ? asStringArray(src.assumptions)
      : ["Assumptions inferred from the request."],
    techStack: techStack.length
      ? techStack
      : [{ name: "TBD", role: "core", category: "other" }],
    chapterTitles: titles.length
      ? titles
      : [
          "System overview",
          "Frontend",
          "Backend API",
          "Database",
          "Local setup & deploy",
        ],
    tradeOffs,
    risks,
  };
}

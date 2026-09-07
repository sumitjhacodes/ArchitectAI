import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeOutline } from "../lib/architecture/normalize-outline";
import { normalizeChapterRaw } from "../lib/architecture/normalize-chapter";
import { chapterToMermaid } from "../lib/architecture/blueprint-to-mermaid";
import { mergeAiSceneWithUserEdits } from "../lib/architecture/scene-merge";

test("normalizeOutline coerces severity and fills defaults", () => {
  const outline = normalizeOutline({
    projectName: "Demo",
    summary: "A demo",
    techStack: [{ name: "Next.js", role: "web", category: "frontend" }],
    chapterTitles: ["System"],
    risks: [{ risk: "Outage", severity: "HIGH", probability: "med" }],
  });
  assert.equal(outline.projectName, "Demo");
  assert.equal(outline.risks[0]?.severity, "high");
  assert.equal(outline.risks[0]?.probability, "medium");
  assert.ok(outline.assumptions.length >= 1);
});

test("normalizeChapterRaw accepts string step numbers and reserved ids", () => {
  const chapter = normalizeChapterRaw(
    {
      chapter: {
        id: "end",
        title: "System Overview",
        goal: "Map the system",
        steps: [{ n: "1", title: "Sketch", detail: "Draw boxes", commands: "npm i" }],
        diagram: {
          type: "architecture",
          nodes: [{ id: "api", label: "API (edge)", kind: "service" }],
          edges: [{ from: "api", to: "db", label: "SQL" }],
        },
      },
    },
    0,
    "System Overview",
  );
  assert.equal(chapter.steps[0]?.n, 1);
  assert.equal(chapter.diagram.type, "system");
  assert.ok(chapter.diagram.nodes.length >= 1);
});

test("chapterToMermaid quotes labels safely", () => {
  const code = chapterToMermaid({
    id: "c1",
    title: "System",
    goal: "g",
    steps: [],
    diagram: {
      type: "system",
      nodes: [
        {
          id: "end",
          label: "Postgres (primary)",
          kind: "db",
          group: "3-data",
        },
      ],
      edges: [],
    },
  });
  assert.match(code, /n_end/);
  assert.match(code, /Postgres \(primary\)/);
  assert.doesNotMatch(code, /\bend\[/);
});

test("mergeAiSceneWithUserEdits keeps non-AI elements", () => {
  const ai = [
    { id: "a1", customData: { architectai: true } },
    { id: "a2", customData: { architectai: true } },
  ];
  const live = [
    { id: "a1", customData: { architectai: true } },
    { id: "user-1", customData: {} },
  ];
  const merged = mergeAiSceneWithUserEdits(ai, live);
  assert.equal(merged.length, 3);
  assert.ok(merged.some((e) => e.id === "user-1"));
});

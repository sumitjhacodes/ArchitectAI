import { blueprintToMarkdown } from "@/lib/architecture/blueprint-to-markdown";
import type { ArchitectureBlueprint } from "@/lib/architecture/schema";
import type { BoardSceneSnapshot } from "@/types/board";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "architecture-plan";
}

/** Download Markdown + blueprint JSON (+ optional Excalidraw scene). */
export function downloadPlanPackage(opts: {
  blueprint: ArchitectureBlueprint;
  scene?: BoardSceneSnapshot | null;
}) {
  const base = slug(opts.blueprint.projectName);
  const md = blueprintToMarkdown(opts.blueprint);
  downloadBlob(
    `${base}-plan.md`,
    new Blob([md], { type: "text/markdown;charset=utf-8" }),
  );
  downloadBlob(
    `${base}-blueprint.json`,
    new Blob([JSON.stringify(opts.blueprint, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
  );
  if (opts.scene?.elements?.length) {
    const excalidrawFile = {
      type: "excalidraw",
      version: 2,
      source: "architectai",
      elements: opts.scene.elements,
      appState: opts.scene.appState ?? {},
      files: {},
    };
    downloadBlob(
      `${base}.excalidraw`,
      new Blob([JSON.stringify(excalidrawFile, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
    );
  }
}

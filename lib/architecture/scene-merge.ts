import type { ArchitectureBlueprint } from "@/lib/architecture/schema";

type SceneElement = {
  id: string;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
};

/** Keep user-drawn elements; replace prior AI-tagged elements with the new blueprint scene. */
export function mergeAiSceneWithUserEdits(
  aiElements: readonly SceneElement[],
  liveElements: readonly SceneElement[],
): SceneElement[] {
  const userEls = liveElements.filter(
    (el) => el.customData?.architectai !== true,
  );
  return [...aiElements, ...userEls];
}

export function isAiElement(el: SceneElement) {
  return el.customData?.architectai === true;
}

export type RefineMode = "full" | "patch";

export function shouldWipeCanvas(
  mode: RefineMode,
  hasExistingBlueprint: boolean,
) {
  return mode === "full" || !hasExistingBlueprint;
}

export function renameFromBlueprint(
  currentName: string,
  blueprint: ArchitectureBlueprint | null,
) {
  if (!blueprint?.projectName) return currentName;
  if (currentName === "Untitled architecture" || !currentName.trim()) {
    return blueprint.projectName;
  }
  return currentName;
}

"use client";

import type { ArchitectureBlueprint } from "@/lib/architecture/schema";
import { useMemo, useState } from "react";

type Props = {
  blueprint: ArchitectureBlueprint;
};

type CheckState = Record<string, boolean>;

export function ReviewStrip({ blueprint }: Props) {
  const keys = useMemo(() => {
    const list: { id: string; kind: string; label: string }[] = [];
    blueprint.assumptions?.forEach((a, i) =>
      list.push({ id: `a-${i}`, kind: "Assumption", label: a }),
    );
    blueprint.tradeOffs?.forEach((t, i) =>
      list.push({
        id: `t-${i}`,
        kind: "Trade-off",
        label: `${t.decision} — ${t.riskMitigation}`,
      }),
    );
    blueprint.risks?.forEach((r, i) =>
      list.push({
        id: `r-${i}`,
        kind: `Risk · ${r.severity}`,
        label: `${r.risk} — ${r.mitigation}`,
      }),
    );
    return list;
  }, [blueprint]);

  const [checked, setChecked] = useState<CheckState>({});

  if (!keys.length) return null;

  return (
    <div className="mb-4 rounded-md border border-[var(--accent)]/35 bg-[var(--accent-tint)]/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
        Review before you build
      </p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">
        Check off assumptions, trade-offs, and risks you have validated.
      </p>
      <ul className="mt-3 space-y-2">
        {keys.map((item) => (
          <li key={item.id} className="flex gap-2 text-xs leading-snug">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={!!checked[item.id]}
              onChange={() =>
                setChecked((prev) => ({
                  ...prev,
                  [item.id]: !prev[item.id],
                }))
              }
              aria-label={`Reviewed: ${item.label}`}
            />
            <span
              className={
                checked[item.id] ? "text-[var(--muted)] line-through" : ""
              }
            >
              <span className="font-medium text-[var(--ink)]">{item.kind}: </span>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

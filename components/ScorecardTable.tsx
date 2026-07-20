"use client";

import { useMemo, useState } from "react";
import type { ZoneScorecardRow } from "@/lib/db";

function pillarColor(pct: number | null): string {
  if (pct === null) return "var(--text-muted)";
  if (pct >= 60) return "var(--status-good)";
  if (pct >= 30) return "var(--status-warning)";
  return "var(--status-critical)";
}

function confidenceColor(tier: string | null): string {
  if (tier === "Full") return "var(--status-good)";
  if (tier === "Partial") return "var(--status-warning)";
  return "var(--text-muted)";
}

function oversupplyColor(twh: number | null): string {
  if (twh === null) return "var(--text-muted)";
  return twh >= 0 ? "var(--status-good)" : "var(--status-critical)";
}

type SortKey =
  | "oversupply"
  | "zone"
  | "pillarA"
  | "pillarB"
  | "pillarC"
  | "pillarD"
  | "minPillar"
  | "bindingPillar"
  | "mean"
  | "confidence";

type Column = {
  key: SortKey;
  label: string;
  align: "left" | "right";
  getValue: (row: ZoneScorecardRow) => number | string | null;
};

const COLUMNS: Column[] = [
  { key: "oversupply", label: "Forecasted oversupply, 2031 (TWh)", align: "right", getValue: (r) => r.oversupply_2031_twh },
  { key: "zone", label: "Country / zone", align: "left", getValue: (r) => r.display_name },
  { key: "pillarA", label: "A: Opportunity", align: "right", getValue: (r) => r.pillar_a_pct },
  { key: "pillarB", label: "B: Economics", align: "right", getValue: (r) => r.pillar_b_pct },
  { key: "pillarC", label: "C: Feasibility", align: "right", getValue: (r) => r.pillar_c_pct },
  { key: "pillarD", label: "D: Durability", align: "right", getValue: (r) => r.pillar_d_pct },
  { key: "minPillar", label: "Min pillar", align: "right", getValue: (r) => r.min_pillar_pct },
  { key: "bindingPillar", label: "Binding pillar", align: "left", getValue: (r) => r.binding_pillar },
  { key: "mean", label: "Mean", align: "right", getValue: (r) => r.mean_pct },
  { key: "confidence", label: "Confidence", align: "left", getValue: (r) => r.confidence },
];

export default function ScorecardTable({ rows }: { rows: ZoneScorecardRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("oversupply");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sortKey)!;
    const withValue = rows.map((r) => ({ row: r, value: column.getValue(r) }));
    withValue.sort((a, b) => {
      if (a.value === null && b.value === null) return 0;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      let cmp: number;
      if (typeof a.value === "number" && typeof b.value === "number") {
        cmp = a.value - b.value;
      } else {
        cmp = String(a.value).localeCompare(String(b.value));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return withValue.map((w) => w.row);
  }, [rows, sortKey, sortDir]);

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: 960 }}>
        <thead>
          <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--gridline)" }}>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`font-medium py-3 px-4 cursor-pointer select-none whitespace-nowrap ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
                onClick={() => handleSort(col.key)}
                title="Click to sort"
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1" style={{ color: "var(--series-1)" }}>
                    {sortDir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.zone_code} style={{ borderTop: "1px solid var(--gridline)" }}>
              <td
                className="py-2 px-4 text-right font-mono font-semibold whitespace-nowrap"
                style={{ color: oversupplyColor(row.oversupply_2031_twh) }}
              >
                {row.oversupply_2031_twh !== null ? row.oversupply_2031_twh.toFixed(2) : "—"}
              </td>
              <td className="py-2 px-4 whitespace-nowrap">
                <a
                  href={`/evaluation?zone=${encodeURIComponent(row.zone_code)}`}
                  className="hover:underline"
                >
                  {row.display_name}
                </a>
              </td>
              <td className="py-2 px-4 text-right" style={{ color: pillarColor(row.pillar_a_pct) }}>
                {row.pillar_a_pct !== null ? `${row.pillar_a_pct}%` : "—"}
              </td>
              <td className="py-2 px-4 text-right" style={{ color: pillarColor(row.pillar_b_pct) }}>
                {row.pillar_b_pct !== null ? `${row.pillar_b_pct}%` : "—"}
              </td>
              <td className="py-2 px-4 text-right" style={{ color: pillarColor(row.pillar_c_pct) }}>
                {row.pillar_c_pct !== null ? `${row.pillar_c_pct}%` : "—"}
              </td>
              <td className="py-2 px-4 text-right" style={{ color: pillarColor(row.pillar_d_pct) }}>
                {row.pillar_d_pct !== null ? `${row.pillar_d_pct}%` : "—"}
              </td>
              <td className="py-2 px-4 text-right font-semibold" style={{ color: pillarColor(row.min_pillar_pct) }}>
                {row.min_pillar_pct !== null ? `${row.min_pillar_pct}%` : "—"}
              </td>
              <td className="py-2 px-4 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {row.binding_pillar ?? "—"}
              </td>
              <td className="py-2 px-4 text-right" style={{ color: "var(--text-secondary)" }}>
                {row.mean_pct !== null ? `${row.mean_pct}%` : "—"}
              </td>
              <td className="py-2 px-4 whitespace-nowrap">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    color: confidenceColor(row.confidence),
                    border: `1px solid ${confidenceColor(row.confidence)}`,
                  }}
                >
                  {row.confidence ?? "—"}
                </span>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="py-6 text-center" style={{ color: "var(--text-muted)" }}>
                No scorecard data loaded.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

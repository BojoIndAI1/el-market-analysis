"use client";

import { useState } from "react";
import type { ZoneRankingRow } from "@/lib/db";

function pillarColor(pct: number | null): string {
  if (pct === null) return "var(--text-muted)";
  if (pct >= 60) return "var(--status-good)";
  if (pct >= 30) return "var(--status-warning)";
  return "var(--status-critical)";
}

function tierColor(tier: string | null): string {
  if (tier === "Full") return "var(--status-good)";
  if (tier === "Partial") return "var(--status-warning)";
  return "var(--text-muted)";
}

export default function RankingRow({ row }: { row: ZoneRankingRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        style={{ borderTop: "1px solid var(--gridline)", cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
          {row.rank}
        </td>
        <td className="py-2 px-4">
          <span className="mr-1" style={{ color: "var(--text-muted)" }}>
            {open ? "▾" : "▸"}
          </span>
          {row.zone_code ? (
            <a
              href={`/evaluation?zone=${encodeURIComponent(row.zone_code)}`}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.display_name}
            </a>
          ) : (
            row.display_name
          )}
        </td>
        <td className="py-2 px-4 text-right font-semibold" style={{ color: pillarColor(row.min_pillar_pct) }}>
          {row.min_pillar_pct !== null ? `${row.min_pillar_pct}%` : "—"}
        </td>
        <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
          {row.binding_pillar ?? "—"}
        </td>
        <td className="py-2 px-4 text-right" style={{ color: "var(--text-secondary)" }}>
          {row.mean_pct !== null ? `${row.mean_pct}%` : "—"}
        </td>
        <td className="py-2 px-4">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ color: tierColor(row.confidence_tier), border: `1px solid ${tierColor(row.confidence_tier)}` }}
          >
            {row.confidence_tier ?? "—"}
          </span>
        </td>
      </tr>
      {open && (
        <tr style={{ background: "var(--page-plane)" }}>
          <td colSpan={6} className="py-3 px-4 text-sm" style={{ color: "var(--text-secondary)" }}>
            {row.confidence_note ?? "No further detail recorded."}
          </td>
        </tr>
      )}
    </>
  );
}

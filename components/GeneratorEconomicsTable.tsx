"use client";

import { useState } from "react";
import type { GeneratorEconomicsTierRow } from "@/lib/db";

export type Tier = {
  label: string;
  rows: GeneratorEconomicsTierRow[];
};

function pillColor(style: string | null): string {
  switch (style) {
    case "additive":
      return "var(--status-good)";
    case "exclusive":
      return "var(--status-critical)";
    case "unresolved":
      return "var(--status-warning)";
    default:
      return "var(--text-muted)";
  }
}

function confidenceColor(style: string | null): string {
  switch (style) {
    case "full":
      return "var(--status-good)";
    case "partial":
      return "var(--status-warning)";
    default:
      return "var(--text-muted)";
  }
}

function TierPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: "var(--gridline)", color }}
    >
      {label}
    </span>
  );
}

function Row({
  row,
  expanded,
  onToggle,
}: {
  row: GeneratorEconomicsTierRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasDetail = row.detail_grid && row.detail_grid.length > 0;
  return (
    <>
      <tr
        className="cursor-pointer"
        style={{ borderTop: "1px solid var(--gridline)" }}
        onClick={hasDetail ? onToggle : undefined}
      >
        <td className="py-2.5 px-3 align-top" style={{ width: 28, color: "var(--text-muted)" }}>
          {hasDetail ? (
            <span
              className="inline-flex items-center justify-center rounded border text-xs"
              style={{ width: 20, height: 20, borderColor: "var(--border-hairline)" }}
            >
              {expanded ? "−" : "+"}
            </span>
          ) : null}
        </td>
        <td
          className="py-2.5 px-3 align-top font-mono text-xs whitespace-nowrap"
          style={{ color: "var(--text-muted)" }}
        >
          {row.rank ?? "—"}
        </td>
        <td className="py-2.5 px-3 align-top whitespace-nowrap">
          <a
            href={`/evaluation?zone=${encodeURIComponent(row.zone_code)}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.display_name}
          </a>
          <span className="block font-mono text-xs" style={{ color: "var(--text-muted)" }}>
            {row.zone_code}
          </span>
        </td>
        <td className="py-2.5 px-3 align-top whitespace-nowrap">
          <div className="font-mono text-sm">{row.price_display ?? "—"}</div>
          {row.price_approx && (
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {row.price_approx}
            </div>
          )}
        </td>
        <td className="py-2.5 px-3 align-top whitespace-nowrap">
          {row.mechanism_label ? (
            <TierPill label={row.mechanism_label} color={pillColor(row.mechanism_style)} />
          ) : (
            "—"
          )}
        </td>
        <td className="py-2.5 px-3 align-top whitespace-nowrap">
          {row.confidence_label ? (
            <TierPill label={row.confidence_label} color={confidenceColor(row.confidence_style)} />
          ) : (
            "—"
          )}
        </td>
      </tr>
      {expanded && hasDetail && (
        <tr style={{ background: "var(--page-plane)" }}>
          <td colSpan={6} className="px-3 pb-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {row.detail_grid!.map(([k, v]) => (
                <div key={k}>
                  <div
                    className="font-mono text-[11px] uppercase tracking-wide mb-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {k}
                  </div>
                  <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function GeneratorEconomicsTable({ tiers }: { tiers: Tier[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      {tiers.map((tier) => (
        <div key={tier.label}>
          <div
            className="font-mono text-xs uppercase tracking-wide mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {tier.label}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 720 }}>
              <thead>
                <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--gridline)" }}>
                  <th style={{ width: 28 }}></th>
                  <th className="text-left font-medium py-2.5 px-3">Rank</th>
                  <th className="text-left font-medium py-2.5 px-3">Zone</th>
                  <th className="text-left font-medium py-2.5 px-3">Switching floor</th>
                  <th className="text-left font-medium py-2.5 px-3">Mechanism</th>
                  <th className="text-left font-medium py-2.5 px-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {tier.rows.map((row) => {
                  const key = row.zone_code;
                  return (
                    <Row
                      key={key}
                      row={row}
                      expanded={expandedKey === key}
                      onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

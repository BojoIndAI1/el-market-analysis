"use client";

import type { AllDataRow } from "@/lib/aggregate";

function fmt(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : v.toFixed(3);
}

const COLUMNS: { key: string; label: string; width: string }[] = [
  { key: "zone", label: "Zone", width: "90px" },
  { key: "year", label: "Year", width: "60px" },
  { key: "genCap", label: "Gen. capacity (TWh)", width: "130px" },
  { key: "demand", label: "Demand (TWh)", width: "120px" },
  { key: "exports", label: "Exports (TWh)", width: "120px" },
  { key: "imports", label: "Imports (TWh)", width: "120px" },
  { key: "oversupply", label: "Oversupply (TWh)", width: "130px" },
  { key: "measuredCurt", label: "Measured curtailment (TWh)", width: "160px" },
  { key: "forecastConf", label: "Forecast confidence", width: "140px" },
  { key: "wsCapMw", label: "W+S capacity (MW)", width: "130px" },
  { key: "cfAssumed", label: "Capacity factor assumed", width: "150px" },
  { key: "wsActual", label: "W+S actual (TWh)", width: "130px" },
  { key: "totalGen", label: "Total generation (TWh)", width: "150px" },
  { key: "curtailment", label: "Curtailment (TWh)", width: "130px" },
  { key: "curtComplete", label: "Curtailment data complete?", width: "160px" },
  { key: "id1", label: "Identity1 gap (TWh)", width: "140px" },
  { key: "id2", label: "Identity2 gap (TWh)", width: "140px" },
];

export default function AllDataTable({ rows }: { rows: AllDataRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {COLUMNS.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--gridline)" }}>
            {COLUMNS.map((c) => (
              <th key={c.key} className="text-left font-medium py-2 px-2 align-bottom">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.zoneCode}-${row.year}`} style={{ borderTop: "1px solid var(--gridline)" }}>
              <td className="py-1.5 px-2 font-medium">{row.zoneCode}</td>
              <td className="py-1.5 px-2">{row.year}</td>
              <td className="py-1.5 px-2 text-right">{fmt(row.generationCapacityTwh)}</td>
              <td className="py-1.5 px-2 text-right">{fmt(row.demandTwh)}</td>
              <td className="py-1.5 px-2 text-right">{fmt(row.exportsTwh)}</td>
              <td className="py-1.5 px-2 text-right">{fmt(row.importsTwh)}</td>
              <td className="py-1.5 px-2 text-right">{fmt(row.oversupplyTwh)}</td>
              <td className="py-1.5 px-2 text-right">{fmt(row.measuredCurtailmentTwh)}</td>
              <td className="py-1.5 px-2" style={{ color: "var(--text-muted)" }}>
                {row.forecastConfidence ?? "—"}
              </td>
              <td className="py-1.5 px-2 text-right">{row.windsolarCapacityMw ?? "—"}</td>
              <td className="py-1.5 px-2 text-right">
                {row.capacityFactorAssumed !== null ? row.capacityFactorAssumed.toFixed(3) : "—"}
              </td>
              <td className="py-1.5 px-2 text-right">{fmt(row.windsolarActualTwh)}</td>
              <td className="py-1.5 px-2 text-right">{fmt(row.totalGenerationTwh)}</td>
              <td className="py-1.5 px-2 text-right">{fmt(row.curtailmentTwh)}</td>
              <td className="py-1.5 px-2" style={{ color: "var(--text-muted)" }}>
                {row.curtailmentDataComplete === null ? "—" : row.curtailmentDataComplete ? "Yes" : "Partial"}
              </td>
              <td className="py-1.5 px-2 text-right">{fmt(row.identity1CheckTwh)}</td>
              <td className="py-1.5 px-2 text-right">{fmt(row.identity2CheckTwh)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="py-4 text-center" style={{ color: "var(--text-muted)" }}>
                No rows for this selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

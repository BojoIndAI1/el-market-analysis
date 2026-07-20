"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import type { ForecastYearPoint, TechMixPoint } from "@/lib/aggregate";
import type {
  ZoneForecastAssumptions,
  GenerationProjectRow,
  DemandOffsetProjectRow,
  GridProjectRow,
} from "@/lib/db";
import SurplusMiniChart from "@/components/SurplusMiniChart";
import TechMixChart from "@/components/TechMixChart";

// d3-geo's fitExtent (used for the precise country crop) runs trig internally
// (atan2/sin/cos for the equal-earth projection) that can produce last-bit-different
// floating point results between Node's server-render and the browser -- a documented
// SSR hazard for react-simple-maps. Rendering client-only (ssr: false) avoids ever having
// a server-computed version to mismatch against, instead of just tolerating the resulting
// hydration-mismatch warning + extra re-render on every page load.
const CountryZoomMap = dynamic(() => import("@/components/CountryZoomMap"), {
  ssr: false,
  loading: () => <div style={{ width: 192, height: 160 }} />,
});

export type ZoneProfile = {
  zoneCode: string;
  forecast: ForecastYearPoint[];
  techMix: TechMixPoint[];
  techMixBuckets: string[];
  assumptions: ZoneForecastAssumptions | null;
  generationProjects: GenerationProjectRow[];
  demandProjects: DemandOffsetProjectRow[];
  transmissionProjects: GridProjectRow[];
};

function confidenceColor(value: string | null): string {
  if (!value) return "var(--text-muted)";
  const v = value.toLowerCase();
  if (v.startsWith("full") || v.startsWith("high")) return "var(--status-good)";
  if (v.startsWith("partial") || v.startsWith("medium") || v.includes("low-medium")) return "var(--status-warning)";
  if (v.startsWith("low")) return "var(--status-serious)";
  return "var(--text-muted)";
}

function probColor(prob: number | null): string {
  if (prob === null) return "var(--text-muted)";
  if (prob >= 0.7) return "var(--status-good)";
  if (prob >= 0.4) return "var(--status-warning)";
  return "var(--status-critical)";
}

function fmtMw(mw: number | null): string {
  return mw === null || mw === undefined ? "—" : `${mw.toLocaleString()} MW`;
}

function fmtPct(v: number | null): string {
  return v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`;
}

export default function ZoneProfileCard({
  displayName,
  profile,
}: {
  displayName: string;
  profile: ZoneProfile;
}) {
  const a = profile.assumptions;

  return (
    <div className="card p-5 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">{displayName}</h2>
        <div className="shrink-0">
          <CountryZoomMap zoneCode={profile.zoneCode} generationProjects={profile.generationProjects} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            Surplus / curtailment per year
          </div>
          <SurplusMiniChart data={profile.forecast} />
        </div>
        <div>
          <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            Generation mix by technology
          </div>
          <TechMixChart data={profile.techMix} buckets={profile.techMixBuckets} compact />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
          Key forecast assumptions{a ? ` (${a.year})` : ""}
        </div>
        {a ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <AssumptionField label="Generation capacity" note={a.generation_capacity_note} />
            <AssumptionField label="Demand" note={a.demand_note} />
            <AssumptionField label="Imports" note={a.imports_note} />
            <AssumptionField label="Exports" note={a.exports_note} />
            <AssumptionField label="Oversupply / curtailment" note={a.oversupply_note} />
            <AssumptionField label="Self-generation demand" note={a.self_generation_note} />
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No bottom-up forecast assumptions recorded for this zone.
          </p>
        )}
        {a?.confidence && (
          <div className="mt-2 text-xs">
            <span style={{ color: "var(--text-muted)" }}>Forecast confidence: </span>
            <span className="font-medium" style={{ color: confidenceColor(a.confidence) }}>
              {a.confidence}
            </span>
          </div>
        )}
      </div>

      <ProjectTable
        title="Generation projects"
        rows={profile.generationProjects}
        emptyText="No named generation projects recorded."
        columns={["Project", "Capacity", "Year", "Confidence"]}
        renderRow={(p: GenerationProjectRow) => (
          <tr key={p.project_name} style={{ borderTop: "1px solid var(--gridline)" }}>
            <td className="py-1.5 pr-3">
              <div>{p.project_name}</div>
              {p.technology && (
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {p.technology}
                </div>
              )}
            </td>
            <td className="py-1.5 pr-3 text-right whitespace-nowrap">{fmtMw(p.capacity_mw)}</td>
            <td className="py-1.5 pr-3 text-right whitespace-nowrap">{p.commissioning_year ?? "—"}</td>
            <td className="py-1.5">
              <span className="text-xs font-medium" style={{ color: confidenceColor(p.confidence) }}>
                {p.confidence ?? "—"}
              </span>
            </td>
          </tr>
        )}
      />

      <ProjectTable
        title="Demand projects"
        rows={profile.demandProjects}
        emptyText="No named demand-side projects recorded."
        columns={["Project", "Capacity", "Year", "Probability (low / mid / high)"]}
        renderRow={(p: DemandOffsetProjectRow) => (
          <tr key={p.project_name} style={{ borderTop: "1px solid var(--gridline)" }}>
            <td className="py-1.5 pr-3">
              <div>{p.project_name}</div>
              {p.load_type && (
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {p.load_type}
                </div>
              )}
            </td>
            <td className="py-1.5 pr-3 text-right whitespace-nowrap">{fmtMw(p.capacity_mw)}</td>
            <td className="py-1.5 pr-3 text-right whitespace-nowrap">{p.commissioning_year ?? "—"}</td>
            <td className="py-1.5 whitespace-nowrap">
              <span style={{ color: probColor(p.prob_low) }}>{fmtPct(p.prob_low)}</span>
              {" / "}
              <span className="font-semibold" style={{ color: probColor(p.prob_mid) }}>
                {fmtPct(p.prob_mid)}
              </span>
              {" / "}
              <span style={{ color: probColor(p.prob_high) }}>{fmtPct(p.prob_high)}</span>
            </td>
          </tr>
        )}
      />

      <ProjectTable
        title="Transmission / grid projects"
        rows={profile.transmissionProjects}
        emptyText="No named transmission/grid projects recorded."
        columns={["Project", "Region", "Capacity", "Year", "Status"]}
        renderRow={(p: GridProjectRow) => (
          <tr key={p.project_name} style={{ borderTop: "1px solid var(--gridline)" }}>
            <td className="py-1.5 pr-3">
              <div>{p.project_name}</div>
              {p.tso && (
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {p.tso}
                </div>
              )}
            </td>
            <td className="py-1.5 pr-3 text-xs" style={{ color: "var(--text-secondary)" }}>
              {p.region ?? "—"}
            </td>
            <td className="py-1.5 pr-3 text-right whitespace-nowrap">{fmtMw(p.added_capacity_mw)}</td>
            <td className="py-1.5 pr-3 text-right whitespace-nowrap">{p.commissioning_year ?? "—"}</td>
            <td className="py-1.5">
              <span className="text-xs font-medium" style={{ color: confidenceColor(p.status) }}>
                {p.status ?? "—"}
              </span>
            </td>
          </tr>
        )}
      />
    </div>
  );
}

function AssumptionField({ label, note }: { label: string; note: string | null }) {
  return (
    <div>
      <div className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {note ?? "—"}
      </div>
    </div>
  );
}

function ProjectTable<T>({
  title,
  rows,
  columns,
  renderRow,
  emptyText,
}: {
  title: string;
  rows: T[];
  columns: string[];
  renderRow: (row: T) => ReactNode;
  emptyText: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
        {title} ({rows.length})
      </div>
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {emptyText}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 480 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                {columns.map((c, i) => (
                  <th
                    key={c}
                    className={`font-medium py-1 ${i === 0 ? "text-left" : i === columns.length - 1 ? "text-left pl-3" : "text-right pr-3"}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{rows.map(renderRow)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

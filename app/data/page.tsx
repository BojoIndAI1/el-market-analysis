"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ZoneMultiSelect from "@/components/ZoneMultiSelect";
import Waterfall from "@/components/Waterfall";
import TechMixChart from "@/components/TechMixChart";
import AllDataTable from "@/components/AllDataTable";
import type { ContinentKey, ZoneRecord } from "@/lib/zones";
import type { DataPageResponse } from "@/lib/aggregate";
import { VESSEL_MW } from "@/lib/vessel";

const CONTINENT_ORDER: ContinentKey[] = [
  "Europe",
  "South America",
  "Asia",
  "Africa",
  "Oceania",
  "North America",
];

export default function DataPage() {
  return (
    <Suspense fallback={<p style={{ color: "var(--text-muted)" }}>Loading…</p>}>
      <DataPageInner />
    </Suspense>
  );
}

function DataPageInner() {
  const searchParams = useSearchParams();
  const zonesParam = searchParams.get("zones");

  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [continent, setContinent] = useState<"Total" | ContinentKey>("Total");
  const [selected, setSelected] = useState<string[]>([]);
  const [data, setData] = useState<DataPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [appliedUrlZones, setAppliedUrlZones] = useState(false);

  useEffect(() => {
    fetch("/api/zones")
      .then((r) => r.json())
      .then((json) => {
        const chartable: ZoneRecord[] = json.zones.filter((z: ZoneRecord) => z.hasForecastData);
        setZones(chartable);
        const requested = zonesParam
          ? zonesParam
              .split(",")
              .map((z) => z.trim())
              .filter((z) => chartable.some((c) => c.zoneCode === z))
          : [];
        if (requested.length > 0) {
          setSelected(requested);
          const firstContinent = chartable.find((c) => c.zoneCode === requested[0])?.continent;
          if (firstContinent) setContinent(firstContinent);
        } else {
          setSelected(chartable.map((z) => z.zoneCode));
        }
        setAppliedUrlZones(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continentOptions = useMemo(() => {
    const present = new Set(zones.map((z) => z.continent));
    return CONTINENT_ORDER.filter((c) => present.has(c));
  }, [zones]);

  const zoneOptions = useMemo(() => {
    const filtered = continent === "Total" ? zones : zones.filter((z) => z.continent === continent);
    return filtered.map((z) => ({ zoneCode: z.zoneCode, displayName: z.displayName }));
  }, [zones, continent]);

  function handleContinentChange(next: "Total" | ContinentKey) {
    setContinent(next);
    const filtered = next === "Total" ? zones : zones.filter((z) => z.continent === next);
    setSelected(filtered.map((z) => z.zoneCode));
  }

  useEffect(() => {
    if (zones.length === 0 || !appliedUrlZones) return;
    setLoading(true);
    const qs = new URLSearchParams({ zones: selected.join(",") });
    fetch(`/api/data?${qs.toString()}`)
      .then((r) => r.json())
      .then((json: DataPageResponse) => setData(json))
      .finally(() => setLoading(false));
  }, [selected, zones, appliedUrlZones]);

  const latestForecast = data?.forecast[data.forecast.length - 1] ?? null;
  const bridgeStartPoint = data?.forecast.find((f) => f.year === 2025) ?? null;

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold mb-1">Data</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Bottom-up generation, demand, exports/imports, and surplus/curtailment, aggregated across
        the selected zones. Curtailment and surplus figures are also expressed as 100MW
        vessel-equivalents (TWh ÷ 0.876 TWh/yr — one vessel operating continuously all year).
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={continent}
          onChange={(e) => handleContinentChange(e.target.value as "Total" | ContinentKey)}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{ borderColor: "var(--border-hairline)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        >
          <option value="Total">Total (all zones)</option>
          {continentOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <ZoneMultiSelect options={zoneOptions} selected={selected} onChange={setSelected} />
      </div>

      {data && data.zonesMissing.length > 0 && (
        <div className="text-xs mb-4" style={{ color: "var(--status-warning)" }}>
          No bottom-up forecast data yet for: {data.zonesMissing.join(", ")}
        </div>
      )}

      {loading && !data ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatTile
              label={`Surplus / curtailment, ${bridgeStartPoint?.year ?? "2025"}`}
              twh={bridgeStartPoint?.oversupplyTwh ?? null}
              vesselEq={bridgeStartPoint?.oversupplyVesselEq ?? null}
            />
            <StatTile
              label={`Surplus / curtailment, ${latestForecast?.year ?? "2031"}e`}
              twh={latestForecast?.oversupplyTwh ?? null}
              vesselEq={latestForecast?.oversupplyVesselEq ?? null}
            />
            <StatTile
              label={`Measured curtailment, ${latestForecast?.year ?? ""}`}
              twh={latestForecast?.measuredCurtailmentTwh ?? null}
              vesselEq={latestForecast?.measuredCurtailmentVesselEq ?? null}
            />
          </div>

          <section className="card p-5 mb-6">
            <h2 className="text-base font-semibold mb-1">Surplus / curtailment bridge, 2025 → 2031e</h2>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Oversupply = Generation Capacity + Imports − Demand − Exports.
            </p>
            <Waterfall steps={data.bridgeSurplus} unit="TWh" />
          </section>

          <section className="card p-5 mb-6">
            <h2 className="text-base font-semibold mb-1">Generation potential bridge, 2025 → 2031e</h2>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              The bottom-up forecast doesn&apos;t split new capacity by technology for every zone, so
              growth is shown as one aggregate step.
            </p>
            <Waterfall steps={data.bridgeGeneration} unit="TWh" />
          </section>

          <section className="card p-5 mb-6">
            <h2 className="text-base font-semibold mb-3">Generation mix, 2021 – 2031</h2>
            <TechMixChart data={data.techMix} />
          </section>

          <section className="card p-5">
            <h2 className="text-base font-semibold mb-3">Historical validation, 2021 – 2025</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
                    <th className="text-left font-medium py-1 pr-4">Year</th>
                    <th className="text-right font-medium py-1 pr-4">Curtailment (TWh)</th>
                    <th className="text-right font-medium py-1 pr-4">Curtailment (vessel-yrs)</th>
                    <th className="text-right font-medium py-1 pr-4">Identity1 gap (TWh)</th>
                    <th className="text-right font-medium py-1 pr-4">Identity2 gap (TWh)</th>
                    <th className="text-left font-medium py-1">Complete?</th>
                  </tr>
                </thead>
                <tbody>
                  {data.historicalValidation.map((row) => (
                    <tr key={row.year} style={{ borderTop: "1px solid var(--gridline)" }}>
                      <td className="py-1 pr-4">{row.year}</td>
                      <td className="text-right py-1 pr-4">{fmt(row.curtailmentTwh)}</td>
                      <td className="text-right py-1 pr-4">{fmt(row.curtailmentVesselEq)}</td>
                      <td className="text-right py-1 pr-4">{fmt(row.identity1CheckTwh)}</td>
                      <td className="text-right py-1 pr-4">{fmt(row.identity2CheckTwh)}</td>
                      <td className="py-1">{row.curtailmentDataComplete ? "Yes" : "Partial"}</td>
                    </tr>
                  ))}
                  {data.historicalValidation.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-3 text-center" style={{ color: "var(--text-muted)" }}>
                        No historical reconciliation rows for this selection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-5 mt-6">
            <h2 className="text-base font-semibold mb-1">All data, per zone and year</h2>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Every raw field from zone_bottom_up_forecast and zone_annual_reconciliation, one row
              per zone per year — not aggregated across the selection, unlike the charts above.
              Granular interconnector flow data is not included here.
            </p>
            <AllDataTable rows={data.allRows} />
          </section>
        </>
      ) : null}
    </div>
  );
}

function fmt(v: number | null): string {
  return v === null || v === undefined ? "—" : v.toFixed(3);
}

function StatTile({ label, twh, vesselEq }: { label: string; twh: number | null; vesselEq: number | null }) {
  return (
    <div className="card p-4">
      <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-2xl font-semibold">{fmt(twh)} TWh</div>
      <div className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
        {vesselEq === null ? "—" : `≈ ${vesselEq.toFixed(1)} × ${VESSEL_MW}MW vessel-years`}
      </div>
    </div>
  );
}

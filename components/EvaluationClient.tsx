"use client";

import { useEffect, useMemo, useState } from "react";
import ZoneMultiSelect from "@/components/ZoneMultiSelect";
import type { ContinentKey, ZoneRecord } from "@/lib/zones";
import type { ZoneEvaluation } from "@/lib/evaluationAssemble";
import type { GeneratorEconomicsCardRow } from "@/lib/db";

const CONTINENT_ORDER: ContinentKey[] = [
  "Europe",
  "South America",
  "Asia",
  "Africa",
  "Oceania",
  "North America",
];

const PILLAR_ORDER = ["A", "B", "C", "D"];

function scoreColor(score: string | null): string {
  const n = Number(score);
  if (Number.isNaN(n)) return "var(--text-muted)";
  if (n >= 5) return "var(--status-good)";
  if (n >= 3) return "var(--status-warning)";
  if (n >= 1) return "var(--status-serious)";
  return "var(--status-critical)";
}

function pillarPctColor(pct: number | null): string {
  if (pct === null) return "var(--text-muted)";
  if (pct >= 60) return "var(--status-good)";
  if (pct >= 30) return "var(--status-warning)";
  return "var(--status-critical)";
}

function confidenceColor(confidence: string | null): string {
  if (!confidence) return "var(--text-muted)";
  const c = confidence.toLowerCase();
  if (c.startsWith("full")) return "var(--status-good)";
  if (c.startsWith("not yet cardable")) return "var(--status-critical)";
  return "var(--status-warning)";
}

function additiveColor(value: string | null): string {
  if (!value) return "var(--text-muted)";
  const v = value.toLowerCase();
  if (v.includes("purely additive") || v.startsWith("additive")) return "var(--status-good)";
  if (v.includes("exclusive")) return "var(--status-critical)";
  if (v.includes("not researched") || v.includes("not yet researched")) return "var(--text-muted)";
  return "var(--status-warning)";
}

export default function EvaluationClient({
  zones,
  initialZones,
}: {
  zones: ZoneRecord[];
  initialZones?: string[];
}) {
  const initialContinent: "Total" | ContinentKey =
    initialZones && initialZones.length > 0
      ? zones.find((z) => z.zoneCode === initialZones[0])?.continent ?? "Total"
      : "Total";

  const [continent, setContinent] = useState<"Total" | ContinentKey>(initialContinent);
  const [selected, setSelected] = useState<string[]>(
    initialZones && initialZones.length > 0 ? initialZones : zones.map((z) => z.zoneCode)
  );
  const [evaluations, setEvaluations] = useState<Record<string, ZoneEvaluation>>({});
  const [loading, setLoading] = useState(true);
  const [genCards, setGenCards] = useState<Record<string, GeneratorEconomicsCardRow>>({});

  useEffect(() => {
    fetch("/api/generator-economics")
      .then((r) => r.json())
      .then((json) => {
        const byZone: Record<string, GeneratorEconomicsCardRow> = {};
        (json.cards ?? []).forEach((c: GeneratorEconomicsCardRow) => {
          byZone[c.zone_code] = c;
        });
        setGenCards(byZone);
      });
  }, []);

  const continentOptions = useMemo(() => {
    const present = new Set(zones.map((z) => z.continent));
    return CONTINENT_ORDER.filter((c) => present.has(c));
  }, [zones]);

  const zoneOptions = useMemo(() => {
    const filtered = continent === "Total" ? zones : zones.filter((z) => z.continent === continent);
    return filtered.map((z) => ({ zoneCode: z.zoneCode, displayName: z.displayName }));
  }, [zones, continent]);

  const zoneByCode = useMemo(() => {
    const map: Record<string, ZoneRecord> = {};
    zones.forEach((z) => (map[z.zoneCode] = z));
    return map;
  }, [zones]);

  function handleContinentChange(next: "Total" | ContinentKey) {
    setContinent(next);
    const filtered = next === "Total" ? zones : zones.filter((z) => z.continent === next);
    setSelected(filtered.map((z) => z.zoneCode));
  }

  useEffect(() => {
    if (selected.length === 0) {
      setEvaluations({});
      return;
    }
    setLoading(true);
    const qs = new URLSearchParams({ zones: selected.join(",") });
    fetch(`/api/evaluations?${qs.toString()}`)
      .then((r) => r.json())
      .then((json) => setEvaluations(json.evaluations ?? {}))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold mb-1">Evaluation</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Qualitative, sourced rationale behind each pillar sub-category score for the selected
        zone(s).
      </p>

      <div className="flex flex-wrap gap-3 mb-8">
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

      {selected.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>Select at least one zone.</p>
      )}
      {loading && selected.length > 0 && Object.keys(evaluations).length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      )}

      <div className="flex flex-col gap-10">
        {selected.map((code) => {
          const ev = evaluations[code];
          if (!ev) {
            if (loading) return null;
            return (
              <div key={code}>
                <h2 className="text-xl font-semibold mb-1">
                  {zoneByCode[code]?.displayName ?? code}
                </h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No qualitative evaluation write-up yet for this zone.
                </p>
              </div>
            );
          }
          return (
            <div key={code}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <h2 className="text-xl font-semibold">{ev.displayName}</h2>
                {ev.minPillarPct !== null && (
                  <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Min-pillar: <span style={{ color: pillarPctColor(ev.minPillarPct) }}>{ev.minPillarPct}%</span>
                    {ev.bindingPillar ? ` (Pillar ${ev.bindingPillar})` : ""}
                    {ev.meanPct !== null ? ` · Mean: ${ev.meanPct}%` : ""}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                {ev.mechanism && <span>{ev.mechanism}</span>}
                {ev.confidence && <span>Confidence: {ev.confidence}</span>}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                {PILLAR_ORDER.filter((p) => ev.pillars[p]).map((p) => {
                  const pillar = ev.pillars[p];
                  return (
                    <div key={p} className="card p-4">
                      <div className="flex items-baseline justify-between mb-3">
                        <h3 className="font-semibold">
                          Pillar {p}
                          {pillar.label ? ` — ${pillar.label}` : ""}
                        </h3>
                        <span className="text-sm font-semibold" style={{ color: pillarPctColor(pillar.pct) }}>
                          {pillar.pct !== null ? `${pillar.pct}%` : "—"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {pillar.subcategories.map((sc) => (
                          <div key={sc.code} className="pl-3" style={{ borderLeft: `3px solid ${scoreColor(sc.score)}` }}>
                            <div className="text-sm font-medium">
                              {sc.code}
                              {sc.label ? ` — ${sc.label}` : ""}
                              <span className="ml-2 font-normal" style={{ color: "var(--text-muted)" }}>
                                score: {sc.score ?? "n/a"}
                              </span>
                            </div>
                            <div className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                              {sc.rationale}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {genCards[code] && (
                <div className="card p-4 mb-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="text-sm font-semibold">Generator Economics</div>
                    <span className="text-xs font-medium" style={{ color: confidenceColor(genCards[code].card_confidence) }}>
                      {genCards[code].card_confidence}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
                        Compensation regime
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>
                        {genCards[code].compensation_regime_basis ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
                        Additive vs. exclusive
                      </div>
                      <div style={{ color: additiveColor(genCards[code].exclusive_or_additive) }}>
                        {genCards[code].exclusive_or_additive ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
                        Switching floor
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>
                        {genCards[code].switching_floor_value ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
                        Legal path
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>{genCards[code].legal_path_note ?? "—"}</div>
                    </div>
                  </div>
                  <a
                    href="/generator-economics"
                    className="inline-block mt-3 text-xs font-medium hover:underline"
                    style={{ color: "var(--series-1)" }}
                  >
                    Full generator economics table →
                  </a>
                </div>
              )}

              {ev.verdict && (
                <div className="card p-4 mb-4">
                  <div className="text-sm font-semibold mb-1">Verdict</div>
                  <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {ev.verdict}
                  </div>
                </div>
              )}

              {ev.nextSteps && ev.nextSteps.length > 0 && (
                <div className="card p-4 mb-4">
                  <div className="text-sm font-semibold mb-2">Concrete next steps</div>
                  <ul className="list-disc pl-5 text-sm flex flex-col gap-1" style={{ color: "var(--text-secondary)" }}>
                    {ev.nextSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {ev.forecastStatus && (
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {ev.forecastStatus}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

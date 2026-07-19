"use client";

import { useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import worldTopology from "world-atlas/countries-110m.json";
import { COUNTRY_ZONES } from "@/lib/countryZones";
import { pctToColor } from "@/lib/colorScale";
import type { ZoneRankingRow, ZoneRankingExcludedRow } from "@/lib/db";
import type { DataPageResponse } from "@/lib/aggregate";
import SurplusMiniChart from "@/components/SurplusMiniChart";

type Popup = {
  country: string;
  x: number;
  y: number;
};

function pillarPctColor(pct: number | null): string {
  if (pct === null) return "var(--text-muted)";
  if (pct >= 60) return "var(--status-good)";
  if (pct >= 30) return "var(--status-warning)";
  return "var(--status-critical)";
}

export default function WorldMap({
  ranked,
  excluded,
}: {
  ranked: ZoneRankingRow[];
  excluded: ZoneRankingExcludedRow[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [popupData, setPopupData] = useState<DataPageResponse | null>(null);
  const [loadingPopup, setLoadingPopup] = useState(false);

  const rankedByZone = useMemo(() => {
    const map = new Map<string, ZoneRankingRow>();
    ranked.forEach((r) => {
      if (r.zone_code) map.set(r.zone_code, r);
    });
    return map;
  }, [ranked]);

  const excludedNames = useMemo(() => new Set(excluded.map((e) => e.display_name)), [excluded]);

  // Best (max) min-pillar score among a country's zones drives its map color --
  // the sub-national detail (and every zone's own score) is in the popup.
  const countryColor = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const [country, zones] of Object.entries(COUNTRY_ZONES)) {
      const scores = zones
        .map((z) => rankedByZone.get(z)?.min_pillar_pct)
        .filter((v): v is number => v !== null && v !== undefined);
      map.set(country, scores.length > 0 ? Math.max(...scores) : null);
    }
    return map;
  }, [rankedByZone]);

  function handleCountryClick(countryName: string, event: React.MouseEvent) {
    if (!COUNTRY_ZONES[countryName]) return;
    const containerRect = containerRef.current?.getBoundingClientRect();
    const x = containerRect ? event.clientX - containerRect.left : event.clientX;
    const y = containerRect ? event.clientY - containerRect.top : event.clientY;
    setPopup({ country: countryName, x, y });
    setPopupData(null);

    const zones = COUNTRY_ZONES[countryName].filter((z) => rankedByZone.has(z));
    if (zones.length === 0) return;
    setLoadingPopup(true);
    const qs = new URLSearchParams({ zones: zones.join(",") });
    fetch(`/api/data?${qs.toString()}`)
      .then((r) => r.json())
      .then((json: DataPageResponse) => setPopupData(json))
      .finally(() => setLoadingPopup(false));
  }

  const popupZones = popup ? (COUNTRY_ZONES[popup.country] ?? []) : [];
  const popupExcludedReason = popup
    ? excluded.find((e) =>
        popupZones.some((z) => {
          const displayName = rankedByZone.get(z)?.display_name;
          return displayName === e.display_name || popup.country === e.display_name;
        }) || excludedNames.has(popup.country)
      )
    : undefined;

  return (
    <div ref={containerRef} className="relative card overflow-hidden" style={{ background: "var(--surface-1)" }}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 145 }}
        width={800}
        height={420}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={worldTopology}>
          {({ geographies, path }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            geographies.map((geo: any) => {
              const name: string = geo.properties?.name ?? "";
              const tracked = !!COUNTRY_ZONES[name];
              const color = countryColor.get(name);
              return (
                <Geography
                  key={geo.rsmKey ?? path(geo)}
                  geography={geo}
                  onClick={(e) => handleCountryClick(name, e)}
                  style={{
                    default: {
                      fill: tracked ? pctToColor(color ?? null) : "#e1e0d9",
                      stroke: "var(--page-plane)",
                      strokeWidth: 0.5,
                      outline: "none",
                      cursor: tracked ? "pointer" : "default",
                    },
                    hover: {
                      fill: tracked ? pctToColor(color ?? null) : "#e1e0d9",
                      stroke: "var(--text-primary)",
                      strokeWidth: tracked ? 1 : 0.5,
                      outline: "none",
                      cursor: tracked ? "pointer" : "default",
                    },
                    pressed: {
                      fill: tracked ? pctToColor(color ?? null) : "#e1e0d9",
                      stroke: "var(--text-primary)",
                      strokeWidth: 1,
                      outline: "none",
                    },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      <div className="flex flex-wrap items-center gap-3 px-4 pb-3 text-xs" style={{ color: "var(--text-muted)" }}>
        <span>Min-pillar score:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: pctToColor(0) }} /> 0%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: pctToColor(50) }} /> 50%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: pctToColor(100) }} /> 100%
        </span>
        <span className="flex items-center gap-1 ml-2">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: pctToColor(null) }} /> excluded
          from ranking (real scorecard exists, click for why)
        </span>
        <span className="flex items-center gap-1 ml-2">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#e1e0d9" }} /> not tracked
        </span>
      </div>

      {popup && (
        <div
          className="absolute z-20 w-80 rounded-lg border shadow-xl p-4"
          style={{
            left: Math.min(popup.x, 800 - 320),
            top: popup.y + 12,
            background: "var(--surface-1)",
            borderColor: "var(--border-hairline)",
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-sm">{popup.country}</h3>
            <button
              onClick={() => setPopup(null)}
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-3 mb-3 text-xs">
            <a
              href={`/data?zones=${encodeURIComponent(popupZones.join(","))}`}
              className="font-medium hover:underline"
              style={{ color: "var(--series-1)" }}
            >
              View on Data page →
            </a>
            <a
              href={`/evaluation?zones=${encodeURIComponent(popupZones.join(","))}`}
              className="font-medium hover:underline"
              style={{ color: "var(--series-1)" }}
            >
              View in Evaluation →
            </a>
          </div>

          {popupExcludedReason ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Excluded from the ranking: {popupExcludedReason.reason}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 mb-3">
                {popupZones.map((z) => {
                  const r = rankedByZone.get(z);
                  if (!r) return null;
                  return (
                    <a
                      key={z}
                      href={`/evaluation?zone=${encodeURIComponent(z)}`}
                      className="flex items-center justify-between text-xs hover:underline"
                    >
                      <span style={{ color: "var(--text-primary)" }}>{r.display_name}</span>
                      <span className="font-semibold" style={{ color: pillarPctColor(r.min_pillar_pct) }}>
                        {r.min_pillar_pct !== null ? `${r.min_pillar_pct}%` : "—"}
                      </span>
                    </a>
                  );
                })}
              </div>

              <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                Surplus / curtailment, 2021 – 2031
              </div>
              {loadingPopup ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Loading…
                </p>
              ) : popupData ? (
                <SurplusMiniChart data={popupData.forecast} />
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

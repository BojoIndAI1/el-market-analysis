"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ZoneMultiSelect from "@/components/ZoneMultiSelect";
import ZoneProfileCard, { type ZoneProfile } from "@/components/ZoneProfileCard";
import type { ContinentKey, ZoneRecord } from "@/lib/zones";

const CONTINENT_ORDER: ContinentKey[] = [
  "Europe",
  "South America",
  "Asia",
  "Africa",
  "Oceania",
  "North America",
];

export default function ZoneProfilePage() {
  return (
    <Suspense fallback={<p style={{ color: "var(--text-muted)" }}>Loading…</p>}>
      <ZoneProfilePageInner />
    </Suspense>
  );
}

function ZoneProfilePageInner() {
  const searchParams = useSearchParams();
  const zonesParam = searchParams.get("zones") ?? searchParams.get("zone");

  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [continent, setContinent] = useState<"Total" | ContinentKey>("Total");
  const [selected, setSelected] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ZoneProfile>>({});
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
          // Zone profiles are expensive per zone (charts + projects) -- default to the first
          // zone rather than every onboarded zone at once, unlike the Data page.
          setSelected(chartable.length > 0 ? [chartable[0].zoneCode] : []);
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
    if (zones.length === 0 || !appliedUrlZones) return;
    if (selected.length === 0) {
      setProfiles({});
      return;
    }
    setLoading(true);
    const qs = new URLSearchParams({ zones: selected.join(",") });
    fetch(`/api/zone-profile?${qs.toString()}`)
      .then((r) => r.json())
      .then((json: { profiles: ZoneProfile[] }) => {
        const byZone: Record<string, ZoneProfile> = {};
        json.profiles.forEach((p) => (byZone[p.zoneCode] = p));
        setProfiles(byZone);
      })
      .finally(() => setLoading(false));
  }, [selected, zones, appliedUrlZones]);

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold mb-1">Zone Profile</h1>
      <p className="text-sm mb-6 max-w-3xl" style={{ color: "var(--text-secondary)" }}>
        Per-zone deep dive: surplus and generation-mix charts at a glance, the forecast&apos;s own
        stated assumptions, and every named project behind the numbers — generation, demand, and
        transmission — with its size and confidence/probability, not just an aggregate figure.
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

      {selected.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>Select at least one zone.</p>
      )}

      {loading && selected.length > 0 && Object.keys(profiles).length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      )}

      <div className="flex flex-col gap-6">
        {selected.map((code) => {
          const profile = profiles[code];
          if (!profile) return null;
          return (
            <ZoneProfileCard
              key={code}
              displayName={zoneByCode[code]?.displayName ?? code}
              profile={profile}
            />
          );
        })}
      </div>
    </div>
  );
}

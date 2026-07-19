import type { ZoneRankingRow } from "@/lib/db";

export type ContinentKey =
  | "Europe"
  | "South America"
  | "Asia"
  | "Africa"
  | "Oceania"
  | "North America";

const CONTINENT_KEYWORDS: [RegExp, ContinentKey][] = [
  [/australia|victoria|nem\b/i, "Oceania"],
  [/texas|ercot/i, "North America"],
  [/brazil|chile|argentina|colombia|paraguay|itaip/i, "South America"],
  [/india|vietnam|\bchina\b|laos/i, "Asia"],
  [/south africa|tunisia|egypt|\bdrc\b|congo|grand inga/i, "Africa"],
  [
    /norway|sweden|denmark|finland|germany|\bgb\b|britain|\buk\b|ireland|spain|portugal|croatia|romania|bulgaria|czechia|czech|italy|sardinia|iceland|greece|netherlands|france|poland|switzerland|austria|belgium|slovakia|slovenia|hungary/i,
    "Europe",
  ],
];

export function inferContinent(displayName: string): ContinentKey {
  for (const [re, continent] of CONTINENT_KEYWORDS) {
    if (re.test(displayName)) return continent;
  }
  return "Europe";
}

export type ZoneRecord = {
  zoneCode: string;
  displayName: string;
  continent: ContinentKey;
  hasForecastData: boolean;
  hasEvaluation: boolean;
};

// Union of every zone we know about, from the ranking table (zone_ranking, DB),
// the evaluation write-ups (zone_evaluation_summary, DB), and the live
// zone_bottom_up_forecast table -- so no page 500s on a zone that's only in one
// source. All three inputs are queried fresh from the DB on each request.
export function buildZoneRegistry(
  forecastZoneCodes: string[],
  rankingRows: ZoneRankingRow[] = [],
  evaluationZoneCodes: string[] = []
): ZoneRecord[] {
  const byCode = new Map<string, ZoneRecord>();

  for (const r of rankingRows) {
    if (!r.zone_code) continue;
    byCode.set(r.zone_code, {
      zoneCode: r.zone_code,
      displayName: r.display_name,
      continent: inferContinent(r.display_name),
      hasForecastData: forecastZoneCodes.includes(r.zone_code),
      hasEvaluation: evaluationZoneCodes.includes(r.zone_code),
    });
  }

  for (const code of evaluationZoneCodes) {
    if (!byCode.has(code)) {
      byCode.set(code, {
        zoneCode: code,
        displayName: code,
        continent: inferContinent(code),
        hasForecastData: forecastZoneCodes.includes(code),
        hasEvaluation: true,
      });
    }
  }

  for (const code of forecastZoneCodes) {
    if (!byCode.has(code)) {
      byCode.set(code, {
        zoneCode: code,
        displayName: code,
        continent: inferContinent(code),
        hasForecastData: true,
        hasEvaluation: false,
      });
    }
  }

  return Array.from(byCode.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function continentsPresent(zones: ZoneRecord[]): ContinentKey[] {
  const set = new Set<ContinentKey>();
  zones.forEach((z) => set.add(z.continent));
  return Array.from(set).sort();
}

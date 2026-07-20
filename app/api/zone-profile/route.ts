import { NextRequest, NextResponse } from "next/server";
import {
  fetchDistinctForecastZones,
  fetchZoneForecastAssumptions,
  fetchGenerationProjects,
  fetchDemandOffsetProjects,
  fetchGridProjects,
} from "@/lib/db";
import { buildDataPageResponse } from "@/lib/aggregate";
import { zonesForGridProjectCountry } from "@/lib/gridProjectZones";

export async function GET(request: NextRequest) {
  const zonesParam = request.nextUrl.searchParams.get("zones") ?? "";
  const zoneCodes = zonesParam
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean);

  if (zoneCodes.length === 0) {
    return NextResponse.json({ profiles: [] });
  }

  const [forecastZonesAvailable, assumptionsRows, generationProjects, demandProjects, gridProjectsAll] =
    await Promise.all([
      fetchDistinctForecastZones(),
      fetchZoneForecastAssumptions(zoneCodes),
      fetchGenerationProjects(zoneCodes),
      fetchDemandOffsetProjects(zoneCodes),
      fetchGridProjects(),
    ]);

  const assumptionsByZone = new Map(assumptionsRows.map((r) => [r.zone_code, r]));

  const transmissionByZone = new Map<string, typeof gridProjectsAll>();
  gridProjectsAll.forEach((p) => {
    for (const zoneCode of zonesForGridProjectCountry(p.country)) {
      if (!zoneCodes.includes(zoneCode)) continue;
      const arr = transmissionByZone.get(zoneCode) ?? [];
      arr.push(p);
      transmissionByZone.set(zoneCode, arr);
    }
  });

  const profiles = await Promise.all(
    zoneCodes.map(async (zoneCode) => {
      const single = await buildDataPageResponse([zoneCode], forecastZonesAvailable);
      return {
        zoneCode,
        forecast: single.forecast,
        techMix: single.techMix,
        techMixBuckets: single.techMixBuckets,
        assumptions: assumptionsByZone.get(zoneCode) ?? null,
        generationProjects: generationProjects.filter((p) => p.zone_code === zoneCode),
        demandProjects: demandProjects.filter((p) => p.zone_code === zoneCode),
        transmissionProjects: transmissionByZone.get(zoneCode) ?? [],
      };
    })
  );

  return NextResponse.json({ profiles });
}

import { NextRequest, NextResponse } from "next/server";
import { fetchDistinctForecastZones } from "@/lib/db";
import { buildDataPageResponse } from "@/lib/aggregate";

export async function GET(request: NextRequest) {
  const zonesParam = request.nextUrl.searchParams.get("zones") ?? "";
  const zoneCodesRequested = zonesParam
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean);

  const forecastZoneCodesAvailable = await fetchDistinctForecastZones();

  const effectiveZones =
    zoneCodesRequested.length > 0 ? zoneCodesRequested : forecastZoneCodesAvailable;

  const data = await buildDataPageResponse(effectiveZones, forecastZoneCodesAvailable);
  return NextResponse.json(data);
}

import { NextResponse } from "next/server";
import { fetchDistinctForecastZones, fetchZoneRanking, fetchEvaluationZoneSummaries } from "@/lib/db";
import { buildZoneRegistry } from "@/lib/zones";

export async function GET() {
  const [forecastZones, rankingRows, evaluationZones] = await Promise.all([
    fetchDistinctForecastZones(),
    fetchZoneRanking(),
    fetchEvaluationZoneSummaries(),
  ]);
  const registry = buildZoneRegistry(forecastZones, rankingRows, evaluationZones);
  return NextResponse.json({ zones: registry });
}

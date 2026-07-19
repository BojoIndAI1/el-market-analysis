import { fetchDistinctForecastZones, fetchZoneRanking, fetchEvaluationZoneSummaries } from "@/lib/db";
import { buildZoneRegistry } from "@/lib/zones";
import EvaluationClient from "@/components/EvaluationClient";

export default async function EvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; zones?: string }>;
}) {
  const { zone, zones: zonesParam } = await searchParams;
  const [forecastZones, rankingRows, evaluationZones] = await Promise.all([
    fetchDistinctForecastZones(),
    fetchZoneRanking(),
    fetchEvaluationZoneSummaries(),
  ]);
  // Same zone set as the Data page (hasForecastData) -- a zone without a written
  // evaluation yet still shows up, with a placeholder, rather than disappearing.
  const registry = buildZoneRegistry(forecastZones, rankingRows, evaluationZones).filter(
    (z) => z.hasForecastData
  );

  const requested = zonesParam
    ? zonesParam.split(",").map((z) => z.trim())
    : zone
      ? [zone]
      : [];
  const registryZoneCodes = registry.map((z) => z.zoneCode);
  const initialZones = requested.filter((z) => registryZoneCodes.includes(z));

  return (
    <EvaluationClient
      zones={registry}
      initialZones={initialZones.length > 0 ? initialZones : undefined}
    />
  );
}

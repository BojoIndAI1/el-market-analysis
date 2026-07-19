import { fetchDistinctForecastZones, fetchZoneRanking, fetchDistinctEvaluationZones } from "@/lib/db";
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
    fetchDistinctEvaluationZones(),
  ]);
  const registry = buildZoneRegistry(forecastZones, rankingRows, evaluationZones).filter(
    (z) => z.hasEvaluation
  );

  const requested = zonesParam
    ? zonesParam.split(",").map((z) => z.trim())
    : zone
      ? [zone]
      : [];
  const initialZones = requested.filter((z) => evaluationZones.includes(z));

  return (
    <EvaluationClient
      zones={registry}
      initialZones={initialZones.length > 0 ? initialZones : undefined}
    />
  );
}

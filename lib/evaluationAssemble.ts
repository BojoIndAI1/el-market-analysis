import type {
  ZoneEvaluationSummaryRow,
  ZoneEvaluationPillarRow,
  ZoneEvaluationSubcategoryRow,
} from "@/lib/db";

export type SubCategory = {
  code: string;
  label: string;
  score: string | null;
  rationale: string | null;
};

export type PillarEvaluation = {
  code: string;
  label: string | null;
  pct: number | null;
  applicableMax: number | null;
  subcategories: SubCategory[];
};

export type ZoneEvaluation = {
  zoneCode: string;
  displayName: string;
  mechanism: string | null;
  pillars: Record<string, PillarEvaluation>;
  minPillarPct: number | null;
  bindingPillar: string | null;
  meanPct: number | null;
  confidence: string | null;
  verdict: string | null;
  nextSteps: string[];
  forecastStatus: string | null;
};

export function assembleEvaluations(data: {
  summaries: ZoneEvaluationSummaryRow[];
  pillars: ZoneEvaluationPillarRow[];
  subcategories: ZoneEvaluationSubcategoryRow[];
}): Record<string, ZoneEvaluation> {
  const result: Record<string, ZoneEvaluation> = {};

  for (const s of data.summaries) {
    result[s.zone_code] = {
      zoneCode: s.zone_code,
      displayName: s.display_name,
      mechanism: s.mechanism,
      pillars: {},
      minPillarPct: s.min_pillar_pct,
      bindingPillar: s.binding_pillar,
      meanPct: s.mean_pct,
      confidence: s.confidence,
      verdict: s.verdict,
      nextSteps: s.next_steps ?? [],
      forecastStatus: s.forecast_status,
    };
  }

  for (const p of data.pillars) {
    const zone = result[p.zone_code];
    if (!zone) continue;
    zone.pillars[p.pillar_code] = {
      code: p.pillar_code,
      label: p.pillar_label,
      pct: p.pct,
      applicableMax: p.applicable_max,
      subcategories: [],
    };
  }

  for (const sc of data.subcategories) {
    const zone = result[sc.zone_code];
    if (!zone) continue;
    if (!zone.pillars[sc.pillar_code]) {
      zone.pillars[sc.pillar_code] = {
        code: sc.pillar_code,
        label: null,
        pct: null,
        applicableMax: null,
        subcategories: [],
      };
    }
    zone.pillars[sc.pillar_code].subcategories.push({
      code: sc.subcategory_code,
      label: sc.subcategory_label,
      score: sc.score,
      rationale: sc.rationale,
    });
  }

  return result;
}

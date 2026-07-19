import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return pool;
}

export type ZoneAnnualRow = {
  zone_code: string;
  year: number;
  windsolar_capacity_mw: number | null;
  windsolar_capacity_factor_assumed: number | null;
  windsolar_potential_twh: number | null;
  curtailment_twh: number | null;
  curtailment_data_complete: boolean | null;
  windsolar_actual_twh: number | null;
  total_generation_twh: number | null;
  demand_twh: number | null;
  exports_twh: number | null;
  imports_twh: number | null;
  identity1_check_twh: number | null;
  identity2_check_twh: number | null;
};

export async function fetchZoneAnnual(zoneCodes: string[]): Promise<ZoneAnnualRow[]> {
  if (zoneCodes.length === 0) return [];
  const pool = getPool();
  const res = await pool.query<ZoneAnnualRow>(
    `SELECT zone_code, year, windsolar_capacity_mw, windsolar_capacity_factor_assumed,
            windsolar_potential_twh, curtailment_twh, curtailment_data_complete,
            windsolar_actual_twh, total_generation_twh, demand_twh, exports_twh,
            imports_twh, identity1_check_twh, identity2_check_twh
       FROM zone_annual_reconciliation
      WHERE zone_code = ANY($1)
      ORDER BY zone_code, year`,
    [zoneCodes]
  );
  return res.rows;
}

export type ForecastRow = {
  zone_code: string;
  year: number;
  generation_capacity_twh: number | null;
  imports_twh: number | null;
  demand_twh: number | null;
  exports_twh: number | null;
  oversupply_twh: number | null;
  measured_curtailment_twh: number | null;
  confidence: string | null;
};

export async function fetchZoneForecast(zoneCodes: string[]): Promise<ForecastRow[]> {
  if (zoneCodes.length === 0) return [];
  const pool = getPool();
  const res = await pool.query<ForecastRow>(
    `SELECT zone_code, year, generation_capacity_twh, imports_twh, demand_twh,
            exports_twh, oversupply_twh, measured_curtailment_twh, confidence
       FROM zone_bottom_up_forecast
      WHERE zone_code = ANY($1)
      ORDER BY zone_code, year`,
    [zoneCodes]
  );
  return res.rows;
}

export async function fetchDistinctForecastZones(): Promise<string[]> {
  const pool = getPool();
  const res = await pool.query<{ zone_code: string }>(
    `SELECT DISTINCT zone_code FROM zone_bottom_up_forecast ORDER BY 1`
  );
  return res.rows.map((r) => r.zone_code);
}

export type ZoneRankingRow = {
  rank: number;
  display_name: string;
  zone_code: string | null;
  min_pillar_pct: number | null;
  binding_pillar: string | null;
  mean_pct: number | null;
  confidence_tier: string | null;
  confidence_note: string | null;
};

export async function fetchZoneRanking(): Promise<ZoneRankingRow[]> {
  const pool = getPool();
  const res = await pool.query<ZoneRankingRow>(
    `SELECT rank, display_name, zone_code, min_pillar_pct, binding_pillar, mean_pct,
            confidence_tier, confidence_note
       FROM zone_ranking
      ORDER BY rank, display_name`
  );
  return res.rows;
}

export type ZoneRankingExcludedRow = {
  display_name: string;
  reason: string;
};

export async function fetchZoneRankingExcluded(): Promise<ZoneRankingExcludedRow[]> {
  const pool = getPool();
  const res = await pool.query<ZoneRankingExcludedRow>(
    `SELECT display_name, reason FROM zone_ranking_excluded ORDER BY display_name`
  );
  return res.rows;
}

export type EvaluationZoneSummary = { zone_code: string; display_name: string };

export async function fetchEvaluationZoneSummaries(): Promise<EvaluationZoneSummary[]> {
  const pool = getPool();
  const res = await pool.query<EvaluationZoneSummary>(
    `SELECT zone_code, display_name FROM zone_evaluation_summary ORDER BY zone_code`
  );
  return res.rows;
}

export type ZoneEvaluationSummaryRow = {
  zone_code: string;
  display_name: string;
  mechanism: string | null;
  min_pillar_pct: number | null;
  binding_pillar: string | null;
  mean_pct: number | null;
  confidence: string | null;
  verdict: string | null;
  next_steps: string[] | null;
  forecast_status: string | null;
};

export type ZoneEvaluationPillarRow = {
  zone_code: string;
  pillar_code: string;
  pillar_label: string | null;
  pct: number | null;
  applicable_max: number | null;
};

export type ZoneEvaluationSubcategoryRow = {
  zone_code: string;
  pillar_code: string;
  subcategory_code: string;
  subcategory_label: string | null;
  score: string | null;
  rationale: string | null;
};

export type MethodologyRankingPrinciple = {
  display_order: number;
  title: string;
  explanation: string;
};

export type MethodologyPillar = {
  pillar_code: string;
  label: string;
  max_points: number;
  guiding_question: string;
};

export type MethodologySubcategory = {
  pillar_code: string;
  subcategory_code: string;
  label: string;
  description: string;
  scoring_anchors: string;
};

export type MethodologyForecastingSection = {
  display_order: number;
  title: string;
  content: string;
};

export async function fetchMethodology(): Promise<{
  principles: MethodologyRankingPrinciple[];
  pillars: MethodologyPillar[];
  subcategories: MethodologySubcategory[];
  forecastingSections: MethodologyForecastingSection[];
  meta: Record<string, unknown>;
}> {
  const pool = getPool();
  const [principles, pillars, subcategories, forecastingSections, meta] = await Promise.all([
    pool.query<MethodologyRankingPrinciple>(
      `SELECT display_order, title, explanation FROM methodology_ranking_principle ORDER BY display_order`
    ),
    pool.query<MethodologyPillar>(
      `SELECT pillar_code, label, max_points, guiding_question FROM methodology_pillar ORDER BY pillar_code`
    ),
    pool.query<MethodologySubcategory>(
      `SELECT pillar_code, subcategory_code, label, description, scoring_anchors
         FROM methodology_subcategory ORDER BY subcategory_code`
    ),
    pool.query<MethodologyForecastingSection>(
      `SELECT display_order, title, content FROM methodology_forecasting_section ORDER BY display_order`
    ),
    pool.query<{ key: string; value: unknown }>(`SELECT key, value FROM methodology_meta`),
  ]);
  const metaMap: Record<string, unknown> = {};
  meta.rows.forEach((r) => {
    metaMap[r.key] = r.value;
  });
  return {
    principles: principles.rows,
    pillars: pillars.rows,
    subcategories: subcategories.rows,
    forecastingSections: forecastingSections.rows,
    meta: metaMap,
  };
}

export async function fetchZoneEvaluations(zoneCodes: string[]): Promise<{
  summaries: ZoneEvaluationSummaryRow[];
  pillars: ZoneEvaluationPillarRow[];
  subcategories: ZoneEvaluationSubcategoryRow[];
}> {
  if (zoneCodes.length === 0) return { summaries: [], pillars: [], subcategories: [] };
  const pool = getPool();
  const [summaries, pillars, subcategories] = await Promise.all([
    pool.query<ZoneEvaluationSummaryRow>(
      `SELECT zone_code, display_name, mechanism, min_pillar_pct, binding_pillar, mean_pct,
              confidence, verdict, next_steps, forecast_status
         FROM zone_evaluation_summary
        WHERE zone_code = ANY($1)`,
      [zoneCodes]
    ),
    pool.query<ZoneEvaluationPillarRow>(
      `SELECT zone_code, pillar_code, pillar_label, pct, applicable_max
         FROM zone_evaluation_pillar
        WHERE zone_code = ANY($1)
        ORDER BY zone_code, pillar_code`,
      [zoneCodes]
    ),
    pool.query<ZoneEvaluationSubcategoryRow>(
      `SELECT zone_code, pillar_code, subcategory_code, subcategory_label, score, rationale
         FROM zone_evaluation_subcategory
        WHERE zone_code = ANY($1)
        ORDER BY zone_code, subcategory_code`,
      [zoneCodes]
    ),
  ]);
  return { summaries: summaries.rows, pillars: pillars.rows, subcategories: subcategories.rows };
}

export type GeneratorEconomicsCardRow = {
  zone_code: string;
  display_name: string;
  compensation_regime_basis: string | null;
  exclusive_or_additive: string | null;
  exclusive_or_additive_note: string | null;
  switching_floor_value: string | null;
  switching_floor_note: string | null;
  marginal_cost_note: string | null;
  merchant_share_note: string | null;
  legal_path_note: string | null;
  counterparty: string | null;
  counterparty_note: string | null;
  card_confidence: string | null;
  source_section: string | null;
  price_display: string | null;
  price_approx: string | null;
  mechanism_label: string | null;
  mechanism_style: string | null;
  confidence_label: string | null;
  confidence_style: string | null;
  detail_grid: [string, string][] | null;
};

export type GeneratorEconomicsTierRow = GeneratorEconomicsCardRow & {
  rank: number | null;
  min_pillar_pct: number | null;
};

const GENERATOR_ECONOMICS_COLS = `zone_code, display_name, compensation_regime_basis, exclusive_or_additive,
            exclusive_or_additive_note, switching_floor_value, switching_floor_note,
            marginal_cost_note, merchant_share_note, legal_path_note, counterparty,
            counterparty_note, card_confidence, source_section, price_display, price_approx,
            mechanism_label, mechanism_style, confidence_label, confidence_style, detail_grid`;

export async function fetchGeneratorEconomicsCards(
  zoneCodes?: string[]
): Promise<GeneratorEconomicsCardRow[]> {
  const pool = getPool();
  if (zoneCodes && zoneCodes.length > 0) {
    const res = await pool.query<GeneratorEconomicsCardRow>(
      `SELECT ${GENERATOR_ECONOMICS_COLS} FROM generator_economics_card WHERE zone_code = ANY($1) ORDER BY zone_code`,
      [zoneCodes]
    );
    return res.rows;
  }
  const res = await pool.query<GeneratorEconomicsCardRow>(
    `SELECT ${GENERATOR_ECONOMICS_COLS} FROM generator_economics_card ORDER BY zone_code`
  );
  return res.rows;
}

export async function fetchGeneratorEconomicsTiers(): Promise<GeneratorEconomicsTierRow[]> {
  const pool = getPool();
  const res = await pool.query<GeneratorEconomicsTierRow>(
    `SELECT g.${GENERATOR_ECONOMICS_COLS.split(", ").join(", g.")}, r.rank, r.min_pillar_pct
       FROM generator_economics_card g
       LEFT JOIN zone_ranking r ON r.zone_code = g.zone_code
      ORDER BY (r.rank IS NULL), r.rank, g.zone_code`
  );
  return res.rows;
}

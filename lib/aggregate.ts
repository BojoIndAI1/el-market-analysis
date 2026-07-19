import { fetchZoneAnnual, fetchZoneForecast, ZoneAnnualRow, ForecastRow } from "@/lib/db";
import { twhToVesselEquivalents } from "@/lib/vessel";

function sum(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

export type ForecastYearPoint = {
  year: number;
  generationCapacityTwh: number | null;
  importsTwh: number | null;
  demandTwh: number | null;
  exportsTwh: number | null;
  netExportsTwh: number | null;
  oversupplyTwh: number | null;
  oversupplyVesselEq: number | null;
  measuredCurtailmentTwh: number | null;
  measuredCurtailmentVesselEq: number | null;
};

export type TechMixPoint = {
  year: number;
  windSolarTwh: number | null;
  otherTwh: number | null;
  otherHeldFlat: boolean;
};

export type BridgeStep = {
  label: string;
  value: number | null;
  kind: "total" | "delta";
};

export type HistoricalValidationPoint = {
  year: number;
  curtailmentTwh: number | null;
  curtailmentVesselEq: number | null;
  identity1CheckTwh: number | null;
  identity2CheckTwh: number | null;
  curtailmentDataComplete: boolean | null;
};

export type AllDataRow = {
  zoneCode: string;
  year: number;
  generationCapacityTwh: number | null;
  demandTwh: number | null;
  exportsTwh: number | null;
  importsTwh: number | null;
  oversupplyTwh: number | null;
  measuredCurtailmentTwh: number | null;
  forecastConfidence: string | null;
  windsolarCapacityMw: number | null;
  capacityFactorAssumed: number | null;
  windsolarActualTwh: number | null;
  totalGenerationTwh: number | null;
  curtailmentTwh: number | null;
  curtailmentDataComplete: boolean | null;
  identity1CheckTwh: number | null;
  identity2CheckTwh: number | null;
};

export type DataPageResponse = {
  zonesRequested: string[];
  zonesResolved: string[];
  zonesMissing: string[];
  forecast: ForecastYearPoint[];
  techMix: TechMixPoint[];
  bridgeSurplus: BridgeStep[];
  bridgeGeneration: BridgeStep[];
  historicalValidation: HistoricalValidationPoint[];
  allRows: AllDataRow[];
};

const BRIDGE_START_YEAR = 2025;
const BRIDGE_END_YEAR = 2031;

export async function buildDataPageResponse(
  zoneCodesRequested: string[],
  forecastZoneCodesAvailable: string[]
): Promise<DataPageResponse> {
  const zonesResolved = zoneCodesRequested.filter((z) => forecastZoneCodesAvailable.includes(z));
  const zonesMissing = zoneCodesRequested.filter((z) => !forecastZoneCodesAvailable.includes(z));

  const [forecastRows, annualRows] = await Promise.all([
    fetchZoneForecast(zonesResolved),
    fetchZoneAnnual(zonesResolved),
  ]);

  const byYearForecast = new Map<number, ForecastRow[]>();
  forecastRows.forEach((row) => {
    const arr = byYearForecast.get(row.year) ?? [];
    arr.push(row);
    byYearForecast.set(row.year, arr);
  });

  const years = Array.from(byYearForecast.keys()).sort((a, b) => a - b);

  const forecast: ForecastYearPoint[] = years.map((year) => {
    const rows = byYearForecast.get(year)!;
    const genCap = sum(rows.map((r) => r.generation_capacity_twh));
    const imports = sum(rows.map((r) => r.imports_twh));
    const demand = sum(rows.map((r) => r.demand_twh));
    const exports = sum(rows.map((r) => r.exports_twh));
    const netExports = exports !== null && imports !== null ? exports - imports : null;
    const oversupply = sum(rows.map((r) => r.oversupply_twh));
    const measuredCurtailment = sum(rows.map((r) => r.measured_curtailment_twh));
    return {
      year,
      generationCapacityTwh: genCap,
      importsTwh: imports,
      demandTwh: demand,
      exportsTwh: exports,
      netExportsTwh: netExports,
      oversupplyTwh: oversupply,
      oversupplyVesselEq: oversupply !== null ? twhToVesselEquivalents(oversupply) : null,
      measuredCurtailmentTwh: measuredCurtailment,
      measuredCurtailmentVesselEq:
        measuredCurtailment !== null ? twhToVesselEquivalents(measuredCurtailment) : null,
    };
  });

  const forecastByYear = new Map(forecast.map((f) => [f.year, f]));

  // --- Tech mix: Wind+Solar (dispatched, post-curtailment) vs. Other (everything
  // else). Wind+Solar = generation capacity - oversupply, available for every
  // forecast-table year. "Other" only has a real historical figure where
  // zone_annual_reconciliation has total_generation_twh; forecast years hold
  // the last known aggregate "Other" flat since non-renewable generation isn't
  // modeled in the bottom-up forecast.
  const byYearAnnual = new Map<number, ZoneAnnualRow[]>();
  annualRows.forEach((row) => {
    const arr = byYearAnnual.get(row.year) ?? [];
    arr.push(row);
    byYearAnnual.set(row.year, arr);
  });

  let lastKnownOther: number | null = null;
  let lastKnownOtherYear = -Infinity;
  const otherByYear = new Map<number, number | null>();
  Array.from(byYearAnnual.keys())
    .sort((a, b) => a - b)
    .forEach((year) => {
      const rows = byYearAnnual.get(year)!;
      const totalGen = sum(rows.map((r) => r.total_generation_twh));
      const windSolar = sum(rows.map((r) => r.windsolar_actual_twh));
      const other = totalGen !== null && windSolar !== null ? totalGen - windSolar : null;
      otherByYear.set(year, other);
      if (other !== null && year >= lastKnownOtherYear) {
        lastKnownOther = other;
        lastKnownOtherYear = year;
      }
    });

  const techMix: TechMixPoint[] = years.map((year) => {
    const fPoint = forecastByYear.get(year);
    const windSolarTwh =
      fPoint && fPoint.generationCapacityTwh !== null && fPoint.oversupplyTwh !== null
        ? fPoint.generationCapacityTwh - fPoint.oversupplyTwh
        : null;
    const directOther = otherByYear.get(year);
    const usingHeldFlat = directOther === undefined || directOther === null;
    return {
      year,
      windSolarTwh,
      otherTwh: usingHeldFlat ? lastKnownOther : directOther,
      otherHeldFlat: usingHeldFlat && lastKnownOther !== null,
    };
  });

  // --- Waterfall bridges, 2025 -> 2031 ---
  const start = forecastByYear.get(BRIDGE_START_YEAR);
  const end = forecastByYear.get(BRIDGE_END_YEAR);

  const bridgeSurplus: BridgeStep[] = [];
  const bridgeGeneration: BridgeStep[] = [];

  if (start && end) {
    const deltaGenCap =
      start.generationCapacityTwh !== null && end.generationCapacityTwh !== null
        ? end.generationCapacityTwh - start.generationCapacityTwh
        : null;
    const deltaDemand =
      start.demandTwh !== null && end.demandTwh !== null ? end.demandTwh - start.demandTwh : null;
    const deltaNetExports =
      start.netExportsTwh !== null && end.netExportsTwh !== null
        ? end.netExportsTwh - start.netExportsTwh
        : null;

    bridgeSurplus.push(
      { label: `Surplus / Curtailment ${BRIDGE_START_YEAR}`, value: start.oversupplyTwh, kind: "total" },
      {
        label: `New generation capacity ${BRIDGE_START_YEAR + 1}-${BRIDGE_END_YEAR}`,
        value: deltaGenCap,
        kind: "delta",
      },
      {
        label: `Incremental demand ${BRIDGE_START_YEAR + 1}-${BRIDGE_END_YEAR}`,
        value: deltaDemand !== null ? -deltaDemand : null,
        kind: "delta",
      },
      {
        label: `Increased net export capacity ${BRIDGE_START_YEAR + 1}-${BRIDGE_END_YEAR}`,
        value: deltaNetExports !== null ? -deltaNetExports : null,
        kind: "delta",
      },
      { label: `Surplus / Curtailment ${BRIDGE_END_YEAR}e`, value: end.oversupplyTwh, kind: "total" }
    );

    bridgeGeneration.push(
      { label: `Generation Potential ${BRIDGE_START_YEAR}`, value: start.generationCapacityTwh, kind: "total" },
      {
        label: `New generation capacity ${BRIDGE_START_YEAR + 1}-${BRIDGE_END_YEAR}`,
        value: deltaGenCap,
        kind: "delta",
      },
      { label: `Generation Potential ${BRIDGE_END_YEAR}e`, value: end.generationCapacityTwh, kind: "total" }
    );
  }

  const historicalValidation: HistoricalValidationPoint[] = Array.from(byYearAnnual.keys())
    .sort((a, b) => a - b)
    .map((year) => {
      const rows = byYearAnnual.get(year)!;
      const curtailment = sum(rows.map((r) => r.curtailment_twh));
      return {
        year,
        curtailmentTwh: curtailment,
        curtailmentVesselEq: curtailment !== null ? twhToVesselEquivalents(curtailment) : null,
        identity1CheckTwh: sum(rows.map((r) => r.identity1_check_twh)),
        identity2CheckTwh: sum(rows.map((r) => r.identity2_check_twh)),
        curtailmentDataComplete: rows.every((r) => r.curtailment_data_complete === true),
      };
    });

  // --- Full, per-zone-per-year table: every raw field from both source tables,
  // joined by (zone, year). No aggregation across zones -- this is the "show me
  // everything" view, deliberately separate from the summed chart data above.
  const allRowsMap = new Map<string, AllDataRow>();
  const keyOf = (zoneCode: string, year: number) => `${zoneCode}__${year}`;

  forecastRows.forEach((r) => {
    allRowsMap.set(keyOf(r.zone_code, r.year), {
      zoneCode: r.zone_code,
      year: r.year,
      generationCapacityTwh: r.generation_capacity_twh,
      demandTwh: r.demand_twh,
      exportsTwh: r.exports_twh,
      importsTwh: r.imports_twh,
      oversupplyTwh: r.oversupply_twh,
      measuredCurtailmentTwh: r.measured_curtailment_twh,
      forecastConfidence: r.confidence,
      windsolarCapacityMw: null,
      capacityFactorAssumed: null,
      windsolarActualTwh: null,
      totalGenerationTwh: null,
      curtailmentTwh: null,
      curtailmentDataComplete: null,
      identity1CheckTwh: null,
      identity2CheckTwh: null,
    });
  });

  annualRows.forEach((r) => {
    const key = keyOf(r.zone_code, r.year);
    const existing = allRowsMap.get(key);
    if (existing) {
      existing.windsolarCapacityMw = r.windsolar_capacity_mw;
      existing.capacityFactorAssumed = r.windsolar_capacity_factor_assumed;
      existing.windsolarActualTwh = r.windsolar_actual_twh;
      existing.totalGenerationTwh = r.total_generation_twh;
      existing.curtailmentTwh = r.curtailment_twh;
      existing.curtailmentDataComplete = r.curtailment_data_complete;
      existing.identity1CheckTwh = r.identity1_check_twh;
      existing.identity2CheckTwh = r.identity2_check_twh;
    } else {
      allRowsMap.set(key, {
        zoneCode: r.zone_code,
        year: r.year,
        generationCapacityTwh: null,
        demandTwh: r.demand_twh,
        exportsTwh: r.exports_twh,
        importsTwh: r.imports_twh,
        oversupplyTwh: null,
        measuredCurtailmentTwh: null,
        forecastConfidence: null,
        windsolarCapacityMw: r.windsolar_capacity_mw,
        capacityFactorAssumed: r.windsolar_capacity_factor_assumed,
        windsolarActualTwh: r.windsolar_actual_twh,
        totalGenerationTwh: r.total_generation_twh,
        curtailmentTwh: r.curtailment_twh,
        curtailmentDataComplete: r.curtailment_data_complete,
        identity1CheckTwh: r.identity1_check_twh,
        identity2CheckTwh: r.identity2_check_twh,
      });
    }
  });

  const allRows = Array.from(allRowsMap.values()).sort((a, b) =>
    a.zoneCode === b.zoneCode ? a.year - b.year : a.zoneCode.localeCompare(b.zoneCode)
  );

  return {
    zonesRequested: zoneCodesRequested,
    zonesResolved,
    zonesMissing,
    forecast,
    techMix,
    bridgeSurplus,
    bridgeGeneration,
    historicalValidation,
    allRows,
  };
}

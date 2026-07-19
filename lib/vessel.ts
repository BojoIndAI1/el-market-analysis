// A 100MW vessel operating continuously for a full year delivers
// 100MW x 8760h = 0.876 TWh/yr. This is the project's "average/illustrative"
// convention (Market-analysis-methodology.md Section 3.9) -- used here since
// per-hour saturation data isn't available for every zone/year combination.
export const VESSEL_MW = 100;
export const VESSEL_ANNUAL_TWH = 0.876;

export function twhToVesselEquivalents(twh: number): number {
  return twh / VESSEL_ANNUAL_TWH;
}

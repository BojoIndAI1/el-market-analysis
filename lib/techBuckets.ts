// Real per-technology generation (zone_generation_by_technology) reports dozens of raw labels
// at wildly different granularity -- DE_LU has a full fuel-level split (gas/hard_coal/lignite/
// nuclear/hydro/onshore_wind/offshore_wind/solar/biomass/oil/waste/...), while most other zones
// only report a coarse "conventional" catch-all alongside wind/solar (or even wind+solar/wind+
// solar+hydro pre-combined). Bucket into a canonical set rather than fabricate a split the source
// data doesn't support -- a zone's "conventional" stays lumped as "Other / conventional", not
// guessed into Gas/Coal/Nuclear.
//
// Kept separate from lib/aggregate.ts (which imports lib/db.ts's `pg` client) so client
// components like TechMixChart can import these constants without pulling `pg` into the browser
// bundle.
export const TECH_BUCKETS: Record<string, string> = {
  nuclear: "Nuclear",
  hard_coal: "Coal",
  lignite: "Coal",
  gas: "Gas",
  hydro: "Hydro",
  pumped_storage: "Hydro",
  onshore_wind: "Wind",
  offshore_wind: "Wind",
  wind: "Wind",
  solar: "Solar",
  biomass: "Biomass",
  oil: "Other / conventional",
  waste: "Other / conventional",
  other_nonren: "Other / conventional",
  other_res: "Other / conventional",
  conventional_thermal: "Other / conventional",
  conventional: "Other / conventional",
  wind_solar_combined: "Wind + Solar (not split in source)",
  wind_solar_hydro_combined: "Wind + Solar + Hydro (not split in source)",
};

// Render order, bottom of the stack to top.
export const TECH_BUCKET_ORDER = [
  "Gas",
  "Coal",
  "Nuclear",
  "Hydro",
  "Biomass",
  "Wind",
  "Solar",
  "Wind + Solar (not split in source)",
  "Wind + Solar + Hydro (not split in source)",
  "Other / conventional",
];

export const TECH_BUCKET_COLOR: Record<string, string> = {
  Gas: "var(--series-6)",
  Coal: "var(--series-5)",
  Nuclear: "var(--series-8)",
  Hydro: "var(--series-2)",
  Biomass: "var(--series-7)",
  Wind: "var(--series-3)",
  Solar: "var(--series-4)",
  "Wind + Solar (not split in source)": "var(--series-3)",
  "Wind + Solar + Hydro (not split in source)": "var(--series-2)",
  "Other / conventional": "var(--series-1)",
};

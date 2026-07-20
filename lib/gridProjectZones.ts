// grid_projects has no zone_code column -- it's keyed by a free-text `country` field that's a
// real, pre-existing mix of ISO-ish codes and full names (confirmed directly against the DB:
// both "DE" and "Germany" appear for the same country). This maps every distinct value found to
// the zone code(s) it applies to. Multi-zone countries (Norway, Sweden, Australia) attach a
// project to every zone in that country, since the project's own `region` field is free text,
// not a zone code -- the region text is shown alongside so it's clear which sub-zone a project
// is really about, rather than silently guessing a single zone.
export const GRID_PROJECT_COUNTRY_ZONES: Record<string, string[]> = {
  DE: ["DE_LU"],
  Germany: ["DE_LU"],
  ES: ["ES"],
  GB: ["GB"],
  Greece: ["GR"],
  India: ["IN"],
  Italy: ["IT_SARD"],
  NO: ["NO1", "NO2", "NO3", "NO4", "NO5"],
  PL: ["PL"],
  SE: ["SE1", "SE2", "SE3", "SE4"],
  Vietnam: ["VN"],
  Argentina: ["AR"],
  Australia: ["AU_SA1", "VIC1"],
  Brazil: ["BR"],
  Chile: ["CL"],
};

export function zonesForGridProjectCountry(country: string): string[] {
  return GRID_PROJECT_COUNTRY_ZONES[country] ?? [];
}

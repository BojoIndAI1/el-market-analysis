// Maps a country name (exactly as it appears in world-atlas's countries-110m.json
// properties.name field) to the zone codes within it that this project tracks.
// Sub-national zones (Norway's price zones, Australia's NEM regions, Texas's West
// zone, Sardinia within Italy) all roll up to their country for the map -- the
// per-zone detail still shows in the popup.
export const COUNTRY_ZONES: Record<string, string[]> = {
  Norway: ["NO1", "NO2", "NO3", "NO4", "NO5"],
  Sweden: ["SE1", "SE2", "SE3", "SE4"],
  Denmark: ["DK1", "DK2"],
  Finland: ["FI"],
  "United Kingdom": ["GB"],
  Germany: ["DE_LU"],
  Ireland: ["IE_SEM"],
  Greece: ["GR"],
  Netherlands: ["NL"],
  France: ["FR"],
  Poland: ["PL"],
  Spain: ["ES"],
  Portugal: ["PT"],
  Croatia: ["HR"],
  Romania: ["RO"],
  Bulgaria: ["BG"],
  Czechia: ["CZ"],
  Italy: ["IT_SARD"],
  Brazil: ["BR"],
  Chile: ["CL"],
  Argentina: ["AR"],
  Paraguay: ["PY"],
  Colombia: ["CO"],
  India: ["IN"],
  Vietnam: ["VN"],
  "South Africa": ["ZA_CAPE"],
  Australia: ["AU_SA1", "VIC1"],
  "United States of America": ["US_ERCOT_WEST"],
  Egypt: ["EG"],
  Tunisia: ["TN"],
};

export function countryForZone(zoneCode: string): string | undefined {
  for (const [country, zones] of Object.entries(COUNTRY_ZONES)) {
    if (zones.includes(zoneCode)) return country;
  }
  return undefined;
}

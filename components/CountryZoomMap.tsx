"use client";

import { useMemo } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-110m.json";
import { countryForZone } from "@/lib/countryZones";

type Bounds = { center: [number, number]; scale: number };

// world-atlas only ships country-level boundaries -- there's no separate Sardinia or
// Victoria polygon to highlight or zoom to individually, only the whole country's. So
// the highlighted shape for these zones is necessarily the whole country (same as
// WorldMap.tsx's own convention: sub-national zones roll up to their country). This
// table only biases WHERE that whole-country view centers, toward the real sub-region,
// so it reads as "this zone is roughly here" -- it must NOT carry its own hand-picked
// scale: an earlier version paired a tight, sub-region-sized scale with the (much
// bigger) whole-country highlight and produced a nonsensical, mostly-off-frame crop
// (confirmed via a real DOM bbox check: Sardinia's override rendered Italy's full
// mainland at scale 5500, bbox 875x993 against an 800x420 viewBox, starting above
// y=0). Scale is always derived from the real matched country's own geometry below.
const ZONE_CENTER_OVERRIDE: Record<string, [number, number]> = {
  VIC1: [144.9, -37.0], // Victoria, Australia
  AU_SA1: [135.5, -30.5], // South Australia
  ZA_CAPE: [19.2, -33.6], // Western Cape, South Africa
  US_ERCOT_WEST: [-102.0, 32.0], // West Texas
  IT_SARD: [9.0, 40.1], // Sardinia, Italy
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const worldFeatures = (feature(worldTopology as any, (worldTopology as any).objects.countries) as any)
  .features as Array<{ properties?: { name?: string }; geometry: { type: string; coordinates: unknown } }>;

// A country's real geometry (already loaded for the map itself) gives an exact bbox --
// no separate centroid dataset to keep in sync as more zones get onboarded.
function boundsFromGeometry(geometry: { type: string; coordinates: unknown }): Bounds | null {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const visitRing = (ring: number[][]) => {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  };
  if (geometry.type === "Polygon") {
    (geometry.coordinates as number[][][]).forEach(visitRing);
  } else if (geometry.type === "MultiPolygon") {
    (geometry.coordinates as number[][][][]).forEach((poly) => poly.forEach(visitRing));
  } else {
    return null;
  }
  if (!isFinite(minLon)) return null;

  const center: [number, number] = [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
  // Latitude degrees read visually "taller" than longitude ones at the mid-latitudes most
  // tracked zones sit in, under this projection -- weight the lat span up so a tall/thin
  // country (Norway, Chile) doesn't zoom out further than it needs to just because its
  // longitude span alone looks narrow.
  const lonSpan = Math.max(maxLon - minLon, 0.5);
  const latSpan = Math.max(maxLat - minLat, 0.5);
  const span = Math.max(lonSpan, latSpan * 1.7);
  // Calibrated against WorldMap's own scale=145 showing the full ~360deg world at
  // width=800 -- 0.6 leaves a visible margin/neighboring-country context rather than
  // cropping tight to the border. Verified against real geometry (getBBox() checks for
  // Norway/Denmark/Brazil/France all landed within the 800x420 viewBox) -- re-check the
  // same way after changing either constant, a hand-picked scale here has broken once
  // already (see ZONE_CENTER_OVERRIDE's comment above).
  const scale = Math.min(6000, Math.max(150, ((145 * 360) / span) * 0.6));
  return { center, scale };
}

export default function CountryZoomMap({ zoneCode }: { zoneCode: string }) {
  const country = countryForZone(zoneCode);

  const bounds = useMemo<Bounds | null>(() => {
    if (!country) return null;
    const match = worldFeatures.find((f) => f.properties?.name === country);
    if (!match) return null;
    const computed = boundsFromGeometry(match.geometry);
    if (!computed) return null;
    const centerOverride = ZONE_CENTER_OVERRIDE[zoneCode];
    return centerOverride ? { center: centerOverride, scale: computed.scale } : computed;
  }, [zoneCode, country]);

  if (!bounds) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Location not available for this zone.
      </p>
    );
  }

  return (
    <div className="rounded-md overflow-hidden" style={{ background: "var(--surface-2)", height: 160 }}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: bounds.scale, center: bounds.center }}
        width={800}
        height={420}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={worldTopology}>
          {({ geographies, path }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            geographies.map((geo: any) => {
              const isTarget = geo.properties?.name === country;
              return (
                <Geography
                  key={geo.rsmKey ?? path(geo)}
                  geography={geo}
                  style={{
                    default: {
                      fill: isTarget ? "var(--series-1)" : "#e1e0d9",
                      stroke: "var(--page-plane)",
                      strokeWidth: 0.5,
                      outline: "none",
                    },
                    hover: {
                      fill: isTarget ? "var(--series-1)" : "#e1e0d9",
                      stroke: "var(--page-plane)",
                      strokeWidth: 0.5,
                      outline: "none",
                    },
                    pressed: {
                      fill: isTarget ? "var(--series-1)" : "#e1e0d9",
                      stroke: "var(--page-plane)",
                      strokeWidth: 0.5,
                      outline: "none",
                    },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ComposableMap, Marker } from "react-simple-maps";
import type { ProjectionFunction } from "react-simple-maps";
import { geoEqualEarth, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-110m.json";
import { countryForZone } from "@/lib/countryZones";
import type { GenerationProjectRow } from "@/lib/db";

const WIDTH = 384;
const HEIGHT = 320;
const PADDING = 10;
const MIN_R = 4;
const MAX_R = 20;

type WorldFeature = { properties?: { name?: string }; geometry: { type: string; coordinates: unknown } };
type Ring = [number, number][];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const worldFeatures = (feature(worldTopology as any, (worldTopology as any).objects.countries) as any)
  .features as WorldFeature[];

function fmtMw(mw: number | null): string {
  return mw === null || mw === undefined ? "—" : `${mw.toLocaleString()} MW`;
}

// Projects every ring of the country's geometry into pixel space via the SAME fitted
// projection used to draw it, so point-in-polygon testing (for scattering project
// bubbles) operates in the same coordinate space as what's actually on screen.
function projectRings(geometry: WorldFeature["geometry"], projection: GeoProjection): Ring[] {
  const projectRing = (ring: number[][]) =>
    ring
      .map((c) => projection(c as [number, number]))
      .filter((p): p is [number, number] => p !== null);
  if (geometry.type === "Polygon") {
    return (geometry.coordinates as number[][][]).map(projectRing);
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][]).flatMap((poly) => poly.map(projectRing));
  }
  return [];
}

// Ray-casting point-in-polygon; treating every ring as an outer boundary is a
// deliberate simplification (doesn't subtract interior lake/hole rings) -- fine for a
// coarse visual scatter, not for precise cartography.
function pointInAnyRing(pt: [number, number], rings: Ring[]): boolean {
  return rings.some((ring) => {
    const [x, y] = pt;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  });
}

// Deterministic per-project pseudo-random position (mulberry32 seeded by a string hash
// of the project name) -- the same project always lands in the same spot on every
// render/reload rather than jittering, without needing to persist a layout anywhere.
function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatterPoint(seedStr: string, rings: Ring[], bbox: [number, number, number, number]): [number, number] {
  const rand = mulberry32(hashString(seedStr));
  const [x0, y0, x1, y1] = bbox;
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = x0 + rand() * (x1 - x0);
    const y = y0 + rand() * (y1 - y0);
    if (pointInAnyRing([x, y], rings)) return [x, y];
  }
  // Rejection sampling failed 40 times in a row (a very thin/irregular shape) -- fall
  // back to the bbox center rather than an obviously-wrong corner.
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

export default function CountryZoomMap({
  zoneCode,
  generationProjects = [],
}: {
  zoneCode: string;
  generationProjects?: GenerationProjectRow[];
}) {
  const country = countryForZone(zoneCode);
  const [openProject, setOpenProject] = useState<string | null>(null);

  const targetFeature = useMemo(
    () => (country ? worldFeatures.find((f) => f.properties?.name === country) ?? null : null),
    [country]
  );

  // fitExtent computes the exact scale+translate needed so targetFeature's own geometry
  // fills the given box (minus padding) -- no hand-tuned span/scale heuristic, and no
  // risk of clipping the country itself, unlike an earlier version of this file.
  const projection = useMemo<GeoProjection | null>(() => {
    if (!targetFeature) return null;
    const proj = geoEqualEarth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proj.fitExtent([[PADDING, PADDING], [WIDTH - PADDING, HEIGHT - PADDING]], targetFeature as any);
    return proj;
  }, [targetFeature]);

  const countryPath = useMemo(() => {
    if (!targetFeature || !projection) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return geoPath(projection)(targetFeature as any) ?? undefined;
  }, [targetFeature, projection]);

  // One bubble per project, placed by rejection-sampling a point inside the country's
  // own (projected) silhouette -- NOT each project's real site. generation_projects has
  // no lat/lon columns yet; scattering within the true shape is an honest "somewhere in
  // this zone" indicator, not a claim of precise siting (see the caption below the map).
  const bubbles = useMemo(() => {
    if (!targetFeature || !projection) return [];
    const rings = projectRings(targetFeature.geometry, projection);
    if (rings.length === 0) return [];
    const xs = rings.flat().map((p) => p[0]);
    const ys = rings.flat().map((p) => p[1]);
    const bbox: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];

    // Sized by MAGNITUDE (Math.abs) -- a retirement (e.g. DE_LU's KVBG coal/lignite
    // phase-out, capacity_mw = -10211) is a real, large entry in this table, not an
    // addition, and negative input would otherwise produce Math.sqrt(negative) = NaN,
    // silently dropping the bubble. Scale is computed from magnitudes across ALL
    // projects (additions and retirements together) so the two are visually comparable.
    const magnitudes = generationProjects.map((p) => p.capacity_mw).filter((c): c is number => c !== null && c !== 0).map(Math.abs);
    const maxMagnitude = magnitudes.length > 0 ? Math.max(...magnitudes) : null;

    return generationProjects.map((p) => {
      const [px, py] = scatterPoint(p.project_name, rings, bbox);
      const magnitude = p.capacity_mw !== null ? Math.abs(p.capacity_mw) : null;
      const radius =
        magnitude && maxMagnitude
          ? MIN_R + (MAX_R - MIN_R) * Math.sqrt(magnitude / maxMagnitude)
          : MIN_R;
      const isRetirement = p.capacity_mw !== null && p.capacity_mw < 0;
      // Marker coordinates are lon/lat, not pixels -- invert the projection to get back
      // to geographic space so <Marker> (which projects internally) lands on our chosen
      // pixel point.
      const inverted = projection.invert ? projection.invert([px, py]) : null;
      return { project: p, coordinates: inverted as [number, number] | null, radius, isRetirement };
    }).filter((b) => b.coordinates !== null);
  }, [targetFeature, projection, generationProjects]);

  if (!targetFeature || !projection) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Location not available for this zone.
      </p>
    );
  }

  const active = bubbles.find((b) => b.project.project_name === openProject);

  return (
    <div className="relative" style={{ width: WIDTH / 2, height: HEIGHT / 2 }}>
      <div className="rounded-md overflow-hidden" style={{ background: "var(--surface-2)", height: HEIGHT / 2 }}>
        <ComposableMap
          // @types/react-simple-maps types `projection` as a (width,height,config) =>
          // GeoProjection builder, but the real runtime code (react-simple-maps'
          // makeProjection: `if (typeof projection === "function") return projection`)
          // never calls it as a builder -- it just uses whatever function you pass AS the
          // projection directly. A d3 projection instance (from fitExtent, above) IS
          // itself a callable function, so passing it straight through is the real
          // supported usage; verified by reading react-simple-maps' own dist source, not
          // just its community types. The cast below exists only because those types
          // describe a calling convention the library doesn't actually use.
          projection={projection as unknown as ProjectionFunction}
          width={WIDTH}
          height={HEIGHT}
          style={{ width: "100%", height: "100%" }}
        >
          <path d={countryPath} fill="var(--series-1)" stroke="var(--page-plane)" strokeWidth={0.75} style={{ outline: "none" }} />
          {bubbles.map(({ project, coordinates, radius, isRetirement }) => (
            <Marker key={project.project_name} coordinates={coordinates!}>
              <circle
                r={radius}
                fill={isRetirement ? "var(--status-critical)" : "var(--status-warning)"}
                fillOpacity={0.75}
                stroke="var(--surface-1)"
                strokeWidth={1}
                style={{ cursor: "pointer" }}
                onClick={() => setOpenProject((v) => (v === project.project_name ? null : project.project_name))}
              />
            </Marker>
          ))}
        </ComposableMap>
      </div>

      {active && (
        <div
          className="absolute z-20 top-full right-0 mt-2 w-64 rounded-lg border shadow-xl p-3"
          style={{ background: "var(--surface-1)", borderColor: "var(--border-hairline)" }}
        >
          <div className="flex items-start justify-between mb-1">
            <div className="text-sm font-medium pr-2">{active.project.project_name}</div>
            <button
              onClick={() => setOpenProject(null)}
              className="text-xs shrink-0"
              style={{ color: "var(--text-muted)" }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {[active.project.technology, fmtMw(active.project.capacity_mw), active.project.commissioning_year]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {active.project.confidence && (
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Confidence: {active.project.confidence}
            </div>
          )}
        </div>
      )}

      {bubbles.length > 0 && (
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          Bubble size = capacity; position is scattered within the zone, not each project&apos;s real site — per-project coordinates aren&apos;t sourced yet.
        </p>
      )}
    </div>
  );
}

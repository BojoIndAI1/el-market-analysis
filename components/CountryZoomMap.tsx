"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ComposableMap, Marker } from "react-simple-maps";
import type { ProjectionFunction } from "react-simple-maps";
import { geoEqualEarth, geoPath, type GeoProjection } from "d3-geo";
import { forceSimulation, forceCollide, forceX, forceY } from "d3-force";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-110m.json";
import { countryForZone } from "@/lib/countryZones";
import type { GenerationProjectRow } from "@/lib/db";
import { TECH_BUCKETS, TECH_BUCKET_COLOR, TECH_BUCKET_ORDER } from "@/lib/techBuckets";

// Same bucketing the "Generation mix by technology" chart uses (TechMixChart.tsx), so a
// technology reads as the same color everywhere on the page, not a second palette
// invented just for this map.
function techBucket(rawTechnology: string | null): string {
  return TECH_BUCKETS[rawTechnology ?? ""] ?? "Other / conventional";
}
function techColor(rawTechnology: string | null): string {
  return TECH_BUCKET_COLOR[techBucket(rawTechnology)] ?? "var(--series-1)";
}

// 40% larger than the original 520x433 -- PADDING/MIN_R/MAX_R/COASTAL_OFFSET are scaled by
// the same 1.4x factor (not left at their old absolute pixel values) so the enlarged map
// looks like a uniformly bigger version of the same design, not a bigger canvas with
// relatively tinier bubbles and relatively tighter padding.
const DISPLAY_WIDTH = 728;
const DISPLAY_HEIGHT = 606;
const WIDTH = DISPLAY_WIDTH * 2;
const HEIGHT = DISPLAY_HEIGHT * 2;
const PADDING = 39;
// As small as practically renderable/hoverable while still reading as a real dot, not a
// slightly-smaller medium dot (see MAX_R's own comment for the density-shrink this used to
// pair with, since removed, and the radius formula below for the curve that gets most
// projects actually down near this floor).
const MIN_R = 2;
const MAX_R = 48;
// How far outside the coastline an offshore project's bubble is placed (internal
// 1456x1212 pixel space) -- far enough to read clearly as "in the water", not so far it
// drifts toward open ocean or off the visible canvas.
const COASTAL_OFFSET = 36;
// Direct user threshold, not a derived statistic: any project at or below this magnitude
// renders at MIN_R flat, no matter how the rest of the zone's capacities are distributed.
// Radius only starts scaling up once a project exceeds this.
const SMALL_PROJECT_THRESHOLD_MW = 50;

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
// of the project name) -- the same project always lands in the same starting spot on
// every render/reload rather than jittering. The collision-declutter step afterward
// nudges it away from overlapping neighbors, but always relative to this same seed.
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

// Linear-interpolated percentile of an already-sorted array. Used to scale bubble radius
// against a robust reference point instead of the raw max -- see its call site's own
// comment for why (a single zone-wide aggregate entry can be 10-100x any real individual
// project's capacity, and scaling against that raw max crushes everyone else's size
// differentiation).
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
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

// For an offshore project: pick a real coastline vertex (from the country's own
// projected ring data used to draw it, not a separate coastline dataset) and offset it
// outward, away from that ring's own centroid, so the point lands in the water just off
// the coast rather than anywhere inside the land polygon. This doesn't know which
// specific sea/named site a project is at -- generation_projects has no lat/lon columns
// -- but it's a real, geometry-driven fix for "offshore project bubble shown inland",
// not a fabricated precise coordinate.
//
// "Vertex minus the ring's own centroid" is only an approximation of the true local
// outward normal -- it can point the WRONG way at a concave stretch of coastline (a bay
// or inlet), landing the "outward" offset back on land or on the far shore instead of at
// sea. Verified this really happens, not just in theory: on DE_LU's real 25-project
// stress test, one project's naive first-guess vertex landed inside land. Fixed the same
// way scatterPoint already handles its own uncertainty -- try several different
// coastline vertices and keep the first one whose offset point actually tests as
// outside the land polygon, rather than trusting the first guess.
function coastalPoint(seedStr: string, rings: Ring[], offset: number): [number, number] {
  const rand = mulberry32(hashString(seedStr + ":coast"));
  const nonEmptyRings = rings.filter((r) => r.length >= 3);
  if (nonEmptyRings.length === 0) return [0, 0];
  const totalVerts = nonEmptyRings.reduce((sum, r) => sum + r.length, 0);

  const vertexAt = (globalIndex: number): { vertex: [number, number]; ring: Ring } => {
    let idx = globalIndex % totalVerts;
    let ring = nonEmptyRings[0];
    for (const r of nonEmptyRings) {
      if (idx < r.length) {
        ring = r;
        break;
      }
      idx -= r.length;
    }
    return { vertex: ring[idx] ?? ring[0], ring };
  };

  let fallback: [number, number] | null = null;
  const attempts = Math.min(60, totalVerts);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { vertex, ring } = vertexAt(Math.floor(rand() * totalVerts));
    const centroid = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]).map((v) => v / ring.length);
    const dx = vertex[0] - centroid[0];
    const dy = vertex[1] - centroid[1];
    const len = Math.hypot(dx, dy) || 1;
    const candidate: [number, number] = [vertex[0] + (dx / len) * offset, vertex[1] + (dy / len) * offset];
    if (!fallback) fallback = candidate;
    if (!pointInAnyRing(candidate, rings)) return candidate;
  }
  // Every attempt landed on land (a very unusual coastline shape) -- the first guess is
  // no worse than any other at that point.
  return fallback ?? [0, 0];
}

type MapMode = "individual" | "state" | "municipality";

const MAP_MODES: { key: MapMode; label: string }[] = [
  { key: "individual", label: "Individual projects" },
  { key: "state", label: "Per State" },
  { key: "municipality", label: "Per Municipality" },
];

// Normalizes both display modes into one shape the placement/declutter/render pipeline
// below can treat identically: "individual" wraps each real project 1:1; "state"/
// "municipality" collapse every project sharing the same (region, technology) into one
// aggregate bubble. Aggregating first, then feeding the SAME geometry pipeline used for
// individual bubbles, avoids duplicating the scatter/coastal/declutter logic per mode.
type BubbleSource = {
  id: string;
  technology: string | null;
  capacityMw: number | null;
  latitude: number | null;
  longitude: number | null;
  isGeocoded: boolean;
} & (
  | { kind: "project"; project: GenerationProjectRow }
  | {
      kind: "aggregate";
      groupLabel: string;
      groupBy: Exclude<MapMode, "individual">;
      projectCount: number;
      geocodedCount: number;
      memberNames: string[];
    }
);

function buildBubbleSources(mode: MapMode, generationProjects: GenerationProjectRow[]): BubbleSource[] {
  if (mode === "individual") {
    return generationProjects.map((p) => ({
      id: p.project_name,
      technology: p.technology,
      capacityMw: p.capacity_mw,
      latitude: p.latitude,
      longitude: p.longitude,
      isGeocoded: p.latitude !== null && p.longitude !== null,
      kind: "project" as const,
      project: p,
    }));
  }

  // Grouped by (region, technology) -- e.g. "Bavaria::onshore_wind" -- not region alone,
  // so the tech-mix character of a place is still visible as separate bubbles rather
  // than one flattened blob per region.
  const regionOf = (p: GenerationProjectRow) => (mode === "state" ? p.state : p.municipality) ?? "Unknown";
  const groups = new Map<string, GenerationProjectRow[]>();
  generationProjects.forEach((p) => {
    const key = `${regionOf(p)}::${p.technology ?? "Unknown"}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  });

  return Array.from(groups.entries()).map(([key, members]) => {
    const groupLabel = regionOf(members[0]);
    const technology = members[0].technology ?? "Unknown";
    const capacities = members.map((m) => m.capacity_mw).filter((c): c is number => c !== null);
    const capacityMw = capacities.length > 0 ? capacities.reduce((a, b) => a + b, 0) : null;
    const geocoded = members.filter((m) => m.latitude !== null && m.longitude !== null);
    // Real position = average of whichever members are actually geocoded (a real,
    // defensible representative point for this region+technology group); falls back to
    // the same seeded scatter/coastal placement as an ungeocoded individual project when
    // NONE of the group's members have a real site yet.
    const latitude = geocoded.length > 0 ? geocoded.reduce((s, m) => s + m.latitude!, 0) / geocoded.length : null;
    const longitude = geocoded.length > 0 ? geocoded.reduce((s, m) => s + m.longitude!, 0) / geocoded.length : null;
    return {
      id: key,
      technology,
      capacityMw,
      latitude,
      longitude,
      isGeocoded: geocoded.length > 0,
      kind: "aggregate" as const,
      groupLabel,
      groupBy: mode,
      projectCount: members.length,
      geocodedCount: geocoded.length,
      memberNames: members.map((m) => m.project_name),
    };
  });
}

type BubbleSeed = {
  id: string;
  x: number;
  y: number;
  r: number;
  isOffshore: boolean;
  isGeocoded: boolean;
  anchorStrength: number;
};

// Spreads overlapping bubbles apart (d3-force's collision detection) while a pull back
// toward each bubble's own seeded position keeps it from drifting far from where it
// started -- so crowded zones (DE_LU's 25 projects) declutter without losing the
// "spread across the country/coast" character a pure collision-only pass would erase.
// Offshore bubbles get a stronger pull-back (anchorStrength) so collision jostling
// doesn't nudge them back onto land; clampBox is wider than the land bbox alone so
// those same offshore bubbles aren't clamped back onto the coast they were just placed
// outside of.
function declutter(
  seeds: BubbleSeed[],
  clampBox: [number, number, number, number],
  isInsideLand: (pt: [number, number]) => boolean
): Map<string, [number, number]> {
  if (seeds.length === 0) return new Map();
  type Node = BubbleSeed & { ox: number; oy: number; vx?: number; vy?: number };
  const nodes: Node[] = seeds.map((s) => ({ ...s, ox: s.x, oy: s.y }));

  const sim = forceSimulation(nodes)
    .force("collide", forceCollide<Node>((d) => d.r + 2).strength(0.9))
    .force("x", forceX<Node>((d) => d.ox).strength((d) => d.anchorStrength))
    .force("y", forceY<Node>((d) => d.oy).strength((d) => d.anchorStrength))
    .stop();
  for (let i = 0; i < 250; i++) sim.tick();

  const [x0, y0, x1, y1] = clampBox;
  const result = new Map<string, [number, number]>();
  for (const n of nodes) {
    let x = Math.min(Math.max(n.x, x0 + n.r), x1 - n.r);
    let y = Math.min(Math.max(n.y, y0 + n.r), y1 - n.r);
    // Collision can, in rare cases, jostle an offshore bubble back onto land -- revert
    // to its original seeded coastal point rather than leave it looking inland.
    if (n.isOffshore && isInsideLand([x, y])) {
      x = n.ox;
      y = n.oy;
    }
    // Symmetric case for ordinary land bubbles: on a very dense zone (DE_LU's 2,600+
    // wind + 1,100 solar projects in "Individual projects" mode) the collision force can
    // push a bubble past the country's real coastline into the clampBox's rectangular
    // corners -- which clampBox alone doesn't catch, since it's a bounding box, not the
    // country's actual (non-rectangular) shape. Every land seed (scatterPoint's rejection
    // sampling, or a real geocoded lon/lat) starts out valid, so reverting to that
    // original seed on violation is always a safe fallback, exactly like the offshore
    // case above. This was invisible before neighboring countries were drawn (the
    // clampBox corners were just blank background); with real neighbors now filling that
    // same area, a reverted-to-original-seed miss would otherwise render sitting on a
    // neighboring country's own shape.
    if (!n.isOffshore && !isInsideLand([x, y])) {
      x = n.ox;
      y = n.oy;
    }
    result.set(n.id, [x, y]);
  }
  return result;
}

export default function CountryZoomMap({
  zoneCode,
  generationProjects = [],
}: {
  zoneCode: string;
  generationProjects?: GenerationProjectRow[];
}) {
  const country = countryForZone(zoneCode);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<MapMode>("individual");
  const [popup, setPopup] = useState<{ id: string; x: number; y: number } | null>(null);
  const [popupPos, setPopupPos] = useState({ left: 0, top: 0 });

  // Same clamping approach as WorldMap.tsx's country-click popup, adapted to hover:
  // position at the real hover point (relative to this component's own container), then
  // nudge back inside the container's edges so it's never cut off or drawn off-screen
  // for a bubble near the border. Re-runs whenever the popup's own content changes size.
  useLayoutEffect(() => {
    if (!popup) return;
    const container = containerRef.current;
    const popupEl = popupRef.current;
    const margin = 8;

    if (!container || !popupEl) {
      setPopupPos({ left: popup.x, top: popup.y + 12 });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const popupWidth = popupEl.offsetWidth;
    const popupHeight = popupEl.offsetHeight;

    let left = popup.x;
    if (left + popupWidth + margin > containerRect.width) {
      left = containerRect.width - popupWidth - margin;
    }
    if (left < margin) left = margin;

    let top = popup.y + 12;
    if (top + popupHeight + margin > containerRect.height) {
      const above = popup.y - popupHeight - 12;
      top = above >= margin ? above : Math.max(margin, containerRect.height - popupHeight - margin);
    }

    setPopupPos({ left, top });
  }, [popup]);

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

  // Drawn UNDER the active country, through the same fitted projection -- since that
  // projection is scaled/translated to the target country's own extent (plus PADDING),
  // whichever real neighbors happen to fall inside that box show up for free, in their
  // real relative position, rather than a fabricated/simplified "neighbors" list. Muted
  // (--gridline, lighter than the active country's --baseline in both themes) so the
  // active country still reads as the highlighted one at a glance, same intent as
  // WorldMap.tsx's tracked-vs-untracked country distinction.
  const neighborPaths = useMemo(() => {
    if (!projection) return [];
    const path = geoPath(projection);
    return worldFeatures
      .filter((f) => f.properties?.name !== country)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f) => ({ name: f.properties?.name, d: path(f as any) }))
      .filter((f): f is { name: string; d: string } => !!f.d);
  }, [projection, country]);

  const bubbleSources = useMemo(() => buildBubbleSources(mode, generationProjects), [mode, generationProjects]);

  // One bubble per BubbleSource (one real project in "individual" mode, one
  // region+technology group in "state"/"municipality" mode). Seeded by rejection-sampling
  // a point inside the country's own (projected) silhouette, then decluttered against
  // every other bubble so they don't overlap -- NOT a claim of precise siting for
  // whichever sources lack real geodata (see the caption below the map).
  const bubbles = useMemo(() => {
    if (!targetFeature || !projection) return [];
    const rings = projectRings(targetFeature.geometry, projection);
    if (rings.length === 0) return [];
    const xs = rings.flat().map((p) => p[0]);
    const ys = rings.flat().map((p) => p[1]);
    const bbox: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    // Offshore bubbles are deliberately placed OUTSIDE the land bbox (in the "water");
    // clamping declutter results to the land bbox alone would push them back onto the
    // coast they were just moved off of, so widen the clamp box by the same offset used
    // to place them plus a margin for the declutter step's own movement.
    const seaMargin = COASTAL_OFFSET + MAX_R + 10;
    const clampBox: [number, number, number, number] = [
      bbox[0] - seaMargin,
      bbox[1] - seaMargin,
      bbox[2] + seaMargin,
      bbox[3] + seaMargin,
    ];

    // Sized by MAGNITUDE (Math.abs) -- a retirement (e.g. DE_LU's KVBG coal/lignite
    // phase-out, capacity_mw = -10211) is a real, large entry in this table, not an
    // addition, and negative input would otherwise produce Math.sqrt(negative) = NaN,
    // silently dropping the bubble. Scale is computed from magnitudes across ALL sources
    // (additions and retirements together) so the two are visually comparable. Computed
    // per-mode (not shared across modes) since aggregate totals are naturally larger
    // than any single project's capacity.
    //
    // The "large" end of the scale is still the 95th percentile, NOT the raw max -- a
    // zone-wide policy aggregate (DE_LU's -10211MW lignite phase-out is a national figure,
    // not one physical plant) can be 10-100x any real individual project's capacity, and
    // scaling against that raw max would collapse the real 50-2000MW range of genuine
    // projects into a barely-different sliver. The true outlier still renders at MAX_R
    // (clamped, see the radius formula below); only everyone else's differentiation
    // depends on this reference point.
    const magnitudes = bubbleSources.map((s) => s.capacityMw).filter((c): c is number => c !== null && c !== 0).map(Math.abs);
    const sortedMagnitudes = [...magnitudes].sort((a, b) => a - b);
    const scaleMagnitude = sortedMagnitudes.length > 0 ? percentile(sortedMagnitudes, 0.95) : null;
    // Previously shrank toward MIN_R as project count went up (written when "dense" meant
    // ~25 projects) -- on DE_LU's 3,700+ individual wind/solar dots (post-MaStR import)
    // that collapsed the WHOLE usable range to a ~4px sliver, which is exactly why small
    // and large real projects rendered as visually the same size regardless of the
    // percentile-scaling fix above. Removed: with MIN_R now genuinely tiny and radius
    // scaled against the 95th percentile (not the raw max), most projects are naturally
    // small already -- only the top ~5% approach MAX_R -- so total on-screen "ink" is
    // lower than the old uniform-medium-everywhere look, not higher; declutter has MORE
    // room to work with, not less.
    const effectiveMaxR = MAX_R;

    const seeds: (BubbleSeed & { source: BubbleSource; isRetirement: boolean })[] = bubbleSources.map((s) => {
      const isOffshore = /offshore/i.test(s.technology ?? "");
      // Real geodata (generation_nodes, joined in fetchGenerationProjects; averaged
      // across a group's geocoded members in aggregate mode) always wins over the
      // algorithmic placement below -- project() converts real lon/lat into the same
      // pixel space scatterPoint/coastalPoint already operate in, so it flows through
      // the identical declutter/collision step as everything else.
      const geocoded = s.latitude !== null && s.longitude !== null ? projection([s.longitude, s.latitude]) : null;
      const isGeocoded = geocoded !== null;
      const [x, y] = geocoded
        ?? (isOffshore ? coastalPoint(s.id, rings, COASTAL_OFFSET) : scatterPoint(s.id, rings, bbox));
      const magnitude = s.capacityMw !== null ? Math.abs(s.capacityMw) : null;
      // Direct user spec: everything at/below SMALL_PROJECT_THRESHOLD_MW (50MW) renders
      // flat at MIN_R, no curve-fitting -- replaces an earlier squared-percentile curve
      // that still left small projects looking medium-sized in practice. Above the
      // threshold, radius scales LINEARLY up to MAX_R at the 95th-percentile scale point
      // (clamped beyond that, so the zone-wide retirement/gas outliers still cap out at
      // MAX_R instead of stretching the scale for every real project below them). If the
      // scale point itself doesn't clear the threshold (a zone with nothing meaningfully
      // large), everything just stays at MIN_R rather than dividing by a near-zero range.
      const r =
        !magnitude || magnitude <= SMALL_PROJECT_THRESHOLD_MW || !scaleMagnitude || scaleMagnitude <= SMALL_PROJECT_THRESHOLD_MW
          ? MIN_R
          : MIN_R +
            (effectiveMaxR - MIN_R) *
              Math.min((magnitude - SMALL_PROJECT_THRESHOLD_MW) / (scaleMagnitude - SMALL_PROJECT_THRESHOLD_MW), 1);
      return {
        id: s.id,
        x,
        y,
        r,
        // A real coordinate should barely move even under heavy collision; an
        // algorithmic offshore placement resists somewhat (so it doesn't get jostled
        // back onto land by a crowded coastline); a plain land scatter point is the
        // most free to move since it was arbitrary to begin with.
        anchorStrength: isGeocoded ? 0.8 : isOffshore ? 0.4 : 0.12,
        isOffshore,
        isGeocoded,
        source: s,
        isRetirement: s.capacityMw !== null && s.capacityMw < 0,
      };
    });

    const declutteredPositions = declutter(seeds, clampBox, (pt) => pointInAnyRing(pt, rings));

    return seeds.map((s) => {
      const [px, py] = declutteredPositions.get(s.id) ?? [s.x, s.y];
      // Marker coordinates are lon/lat, not pixels -- invert the projection to get back
      // to geographic space so <Marker> (which projects internally) lands on our chosen
      // pixel point.
      const inverted = projection.invert ? projection.invert([px, py]) : null;
      return {
        source: s.source,
        coordinates: inverted as [number, number] | null,
        radius: s.r,
        isRetirement: s.isRetirement,
        isGeocoded: s.isGeocoded,
      };
    }).filter((b) => b.coordinates !== null);
  }, [targetFeature, projection, bubbleSources]);

  // Legend lists only technologies actually present in the current mode/zone, in the
  // same canonical order as the "Generation mix by technology" chart -- not a fixed
  // universal list that would show irrelevant swatches for a zone missing most of them.
  const presentBuckets = useMemo(() => {
    const present = new Set(bubbleSources.map((s) => techBucket(s.technology)));
    return TECH_BUCKET_ORDER.filter((b) => present.has(b));
  }, [bubbleSources]);

  if (!targetFeature || !projection) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Location not available for this zone.
      </p>
    );
  }

  const active = bubbles.find((b) => b.source.id === popup?.id);

  return (
    // Width only, deliberately no fixed height -- this wrapper also holds the mode-toggle
    // buttons above the map and the legend/caption below it, whose combined height varies
    // (more technologies -> legend wraps to more lines). A fixed height here (previously
    // == DISPLAY_HEIGHT, matching only the map canvas below) let that extra content
    // overflow past the box's bottom edge without growing it, so the next sibling in
    // ZoneProfileCard's flex-col (the Surplus/Generation-mix charts row) started right
    // where this box nominally ended, visually overlapping the spilled-over legend/caption
    // text -- reproduced on a dense zone (many technologies -> multi-line legend).
    <div ref={containerRef} className="relative" style={{ width: DISPLAY_WIDTH }}>
      <div className="flex gap-1 mb-2">
        {MAP_MODES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setMode(key);
              setPopup(null);
            }}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
            style={{
              background: mode === key ? "var(--series-1)" : "var(--surface-2)",
              color: mode === key ? "var(--page-plane)" : "var(--text-muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="rounded-md overflow-hidden" style={{ background: "var(--surface-2)", height: DISPLAY_HEIGHT }}>
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
          {/* Real neighboring countries, for geographic context -- muted so the active
              country (below) still reads as the highlighted one. Non-interactive: these
              exist to orient the viewer, not to be clicked/hovered like WorldMap.tsx's
              country picker. */}
          {neighborPaths.map(({ name, d }) => (
            <path
              key={name}
              d={d}
              fill="var(--gridline)"
              stroke="var(--page-plane)"
              strokeWidth={0.5}
              style={{ outline: "none", pointerEvents: "none" }}
            />
          ))}
          {/* Neutral (not one of the 8 series colors) -- bubbles are colored by technology
              below, and "Other / conventional" happens to reuse series-1, the same color
              the land used to be filled with before per-technology coloring existed. */}
          <path d={countryPath} fill="var(--baseline)" stroke="var(--page-plane)" strokeWidth={1} style={{ outline: "none" }} />
          {bubbles.map(({ source, coordinates, radius, isRetirement, isGeocoded }) => (
            <Marker key={source.id} coordinates={coordinates!}>
              <circle
                r={radius}
                fill={techColor(source.technology)}
                fillOpacity={popup?.id === source.id ? 0.95 : 0.75}
                // A crisper, thicker ring marks a real, sourced location (see
                // generation_nodes) apart from an algorithmically-placed one -- shown
                // plainly rather than left for the user to guess at from position alone.
                // A dashed ring marks a retirement/phase-out (negative capacity_mw) --
                // moved here from fill color once fill started encoding technology instead.
                stroke={isGeocoded ? "var(--text-primary)" : "var(--surface-1)"}
                // Scaled down for small radii, capped at the same 2.5/1.5 used for
                // medium+ dots -- a flat stroke width made the MIN_R-sized dots (most
                // wind projects are geocoded, so most tiny dots hit the isGeocoded case)
                // look chunky regardless of their true small radius, since a 2.5px ring
                // is bigger than a 2px radius fill. Real bug, not cosmetic: verified live
                // on el-market-analysis.online that the radius fix alone didn't read as
                // "tiny" because of this.
                strokeWidth={Math.min(isGeocoded ? 2.5 : 1.5, radius * 0.6)}
                strokeDasharray={isRetirement ? "3,2" : undefined}
                style={{ cursor: "pointer" }}
                onMouseEnter={(event) => {
                  const containerRect = containerRef.current?.getBoundingClientRect();
                  const x = containerRect ? event.clientX - containerRect.left : event.clientX;
                  const y = containerRect ? event.clientY - containerRect.top : event.clientY;
                  setPopup({ id: source.id, x, y });
                }}
                onMouseLeave={() => setPopup(null)}
              />
            </Marker>
          ))}
        </ComposableMap>
      </div>

      {presentBuckets.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {presentBuckets.map((bucket) => (
            <div key={bucket} className="flex items-center gap-1.5">
              <span
                className="inline-block rounded-full"
                style={{ width: 9, height: 9, background: TECH_BUCKET_COLOR[bucket] ?? "var(--series-1)" }}
              />
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {bucket}
              </span>
            </div>
          ))}
        </div>
      )}

      {active && (
        <div
          ref={popupRef}
          className="absolute z-20 w-72 rounded-lg border shadow-xl p-3 pointer-events-none"
          style={{
            left: popupPos.left,
            top: popupPos.top,
            background: "var(--surface-1)",
            borderColor: "var(--border-hairline)",
          }}
        >
          {active.source.kind === "project" ? (
            <>
              <div className="text-sm font-medium mb-1">{active.source.project.project_name}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {[active.source.project.technology, fmtMw(active.source.project.capacity_mw), active.source.project.commissioning_year]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {active.source.project.confidence && (
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Confidence: {active.source.project.confidence}
                </div>
              )}
              <div className="text-xs mt-1.5 pt-1.5" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--gridline)" }}>
                {active.isGeocoded ? (
                  <>
                    Real, sourced location
                    {active.source.project.location_source && (
                      <> — {(() => {
                        try {
                          return new URL(active.source.project.location_source).hostname.replace(/^www\./, "");
                        } catch {
                          return active.source.project.location_source;
                        }
                      })()}</>
                    )}
                  </>
                ) : (
                  "Approximate position — not this project's real site"
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium mb-1">{active.source.groupLabel}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {[active.source.technology, fmtMw(active.source.capacityMw)].filter(Boolean).join(" · ")}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {active.source.projectCount} project{active.source.projectCount === 1 ? "" : "s"}
              </div>
              <div className="text-xs mt-1.5 pt-1.5" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--gridline)" }}>
                {active.source.memberNames.slice(0, 6).join(", ")}
                {active.source.memberNames.length > 6 && ` +${active.source.memberNames.length - 6} more`}
              </div>
              <div className="text-xs mt-1.5 pt-1.5" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--gridline)" }}>
                {active.source.geocodedCount === 0
                  ? "Approximate position — no member project has a real, sourced site yet"
                  : active.source.geocodedCount === active.source.projectCount
                  ? "Real, sourced location (averaged across all member projects)"
                  : `Real, sourced location (averaged across ${active.source.geocodedCount} of ${active.source.projectCount} member projects with a known site)`}
              </div>
            </>
          )}
        </div>
      )}

      {bubbles.length > 0 && (
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          {mode === "individual"
            ? "Bubble size = capacity, color = technology (see legend). Thick-ringed bubbles are real, sourced locations; thin-ringed ones are an approximate position within the zone only. Dashed ring = a retirement/phase-out, not a new project — hover for detail."
            : `Bubble size = total capacity per ${mode === "state" ? "State" : "Municipality"} per technology, color = technology (see legend). Thick-ringed bubbles average at least one real, sourced project location; thin-ringed ones are approximate. Dashed ring = a net retirement/phase-out in that group — hover for detail.`}
        </p>
      )}
    </div>
  );
}

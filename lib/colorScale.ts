// Sequential 0-100% "how investable" scale, stepping through the same status
// hues used elsewhere in the app: critical red -> warning amber -> good green.
const STOPS: [number, [number, number, number]][] = [
  [0, [208, 59, 59]], // --status-critical #d03b3b
  [50, [250, 178, 25]], // --status-warning #fab219
  [100, [12, 163, 12]], // --status-good #0ca30c
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function pctToColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "#c3c2b7"; // --baseline (no data)
  const clamped = Math.max(0, Math.min(100, pct));
  let lower = STOPS[0];
  let upper = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (clamped >= STOPS[i][0] && clamped <= STOPS[i + 1][0]) {
      lower = STOPS[i];
      upper = STOPS[i + 1];
      break;
    }
  }
  const span = upper[0] - lower[0] || 1;
  const t = (clamped - lower[0]) / span;
  const r = Math.round(lerp(lower[1][0], upper[1][0], t));
  const g = Math.round(lerp(lower[1][1], upper[1][1], t));
  const b = Math.round(lerp(lower[1][2], upper[1][2], t));
  return `rgb(${r}, ${g}, ${b})`;
}

import { fetchGeneratorEconomicsTiers } from "@/lib/db";
import GeneratorEconomicsTable, { type Tier } from "@/components/GeneratorEconomicsTable";

function buildTiers(rows: Awaited<ReturnType<typeof fetchGeneratorEconomicsTiers>>): Tier[] {
  const tiers: Tier[] = [];
  let current: Tier | null = null;

  for (const row of rows) {
    const label =
      row.rank !== null
        ? `Rank ${row.rank} — min-pillar ${row.min_pillar_pct}%`
        : "Excluded from the standard ranking (different mechanism — Mechanism 6/7, BPO, or pre-commercial)";
    if (!current || current.label !== label) {
      current = { label, rows: [] };
      tiers.push(current);
    }
    current.rows.push(row);
  }
  return tiers;
}

export default async function GeneratorEconomicsPage() {
  const rows = await fetchGeneratorEconomicsTiers();
  const tiers = buildTiers(rows);
  const covered = rows.filter((r) => r.price_display && r.price_display !== "— not covered —").length;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold mb-1">Generator switching-floor economics</h1>
      <p className="text-sm mb-6 max-w-3xl" style={{ color: "var(--text-secondary)" }}>
        How cheap the power actually is once you account for compensation mechanics, not just the
        headline spot price — across every zone in the ranking.
      </p>

      <div className="flex gap-0 rounded-lg overflow-hidden mb-6 card">
        <div className="flex-1 p-4" style={{ borderRight: "1px solid var(--border-hairline)" }}>
          <div className="font-mono text-xl font-semibold tabular-nums">
            {covered} / {rows.length}
          </div>
          <div className="text-xs uppercase tracking-wide mt-0.5" style={{ color: "var(--text-muted)" }}>
            zones covered
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="font-mono text-xl font-semibold tabular-nums">{rows.length - covered}</div>
          <div className="text-xs uppercase tracking-wide mt-0.5" style={{ color: "var(--text-muted)" }}>
            gap
          </div>
        </div>
      </div>

      <div
        className="card p-4 mb-8 text-sm"
        style={{ borderLeft: "3px solid var(--series-1)", color: "var(--text-secondary)" }}
      >
        <b style={{ color: "var(--text-primary)" }}>What &quot;switching floor&quot; means:</b> the
        effective price a third-party buyer would need to beat to make a generator prefer selling to
        them over its existing outlet — the real spot/PPA price where curtailment is uncompensated
        (near-zero, purely additive upside), or the compensation-claim value where a generator is
        already being paid to curtail (a competing, exclusive claim to displace). Click a row for the
        full sourced rationale. See{" "}
        <a href="/methodology" className="underline">
          Methodology
        </a>{" "}
        for the full switching-floor formula (Section 9.58).
      </div>

      <GeneratorEconomicsTable tiers={tiers} />

      <p className="text-xs mt-8 max-w-3xl" style={{ color: "var(--text-muted)" }}>
        Currency note: approximate EUR-equivalents shown alongside are indicative only, for rough
        relative ordering — not a precise dated FX conversion. Where curtailment is confirmed
        uncompensated, the near-zero/discount figure is the real switching floor (a buyer&apos;s
        offer is close to pure upside); where a general market average is the only figure found,
        treat it as context, not a confirmed floor.
      </p>
    </div>
  );
}

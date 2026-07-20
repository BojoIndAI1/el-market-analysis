import { fetchZoneScorecard } from "@/lib/db";
import ScorecardTable from "@/components/ScorecardTable";

export default async function ScorecardPage() {
  const rows = await fetchZoneScorecard();

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold mb-1">Scorecard</h1>
      <p className="text-sm mb-6 max-w-3xl" style={{ color: "var(--text-secondary)" }}>
        Every onboarded country/zone with a real scorecard — full Pillar A-D breakdown alongside
        each zone&apos;s forecasted 2031 surplus/curtailment (bottom-up forecast). Click any column
        header to sort. Colombia and Paraguay have full pillar breakdowns but no bottom-up 2031
        forecast (a different mechanism, Section 9.85/9.90) and no min-pillar ranking (excluded
        from the standard scorecard for the same reason) — both show as “—”, not zero. See{" "}
        <a href="/methodology" className="underline">
          Methodology
        </a>{" "}
        for the full scoring definitions.
      </p>
      <ScorecardTable rows={rows} />
    </div>
  );
}

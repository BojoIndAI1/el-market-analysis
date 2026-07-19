import { fetchMethodology } from "@/lib/db";
import MethodologyTabs from "@/components/MethodologyTabs";

const PILLAR_ORDER = ["A", "B", "C", "D"];

type VesselEquivalentMeta = {
  vessel_mw: number;
  annual_twh_continuous: number;
  conventions: { name: string; label: string; formula: string; description: string }[];
};

type SupplementaryMeta = { name: string; full_name: string; description: string }[];

export default async function MethodologyPage() {
  const { principles, pillars, subcategories, forecastingSections, meta } = await fetchMethodology();

  const vesselEquivalent = meta.vesselEquivalent as VesselEquivalentMeta | undefined;
  const rankingMetric = meta.rankingMetric as string | undefined;
  const scoringAnchorsText = meta.scoringAnchorsText as string | undefined;
  const supplementary = (meta.supplementary as SupplementaryMeta | undefined) ?? [];

  const subcategoriesByPillar = new Map<string, typeof subcategories>();
  subcategories.forEach((sc) => {
    const arr = subcategoriesByPillar.get(sc.pillar_code) ?? [];
    arr.push(sc);
    subcategoriesByPillar.set(sc.pillar_code, arr);
  });

  const rankingContent = (
    <div className="flex flex-col gap-8">
      <section className="card p-5">
        <h2 className="text-base font-semibold mb-2">Ranking metric</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {rankingMetric}
        </p>
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold mb-3">Design principles</h2>
        <div className="flex flex-col gap-4">
          {principles.map((p) => (
            <div key={p.title} className="pl-3" style={{ borderLeft: "3px solid var(--series-1)" }}>
              <div className="text-sm font-medium">{p.title}</div>
              <div className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {p.explanation}
              </div>
            </div>
          ))}
        </div>
      </section>

      {scoringAnchorsText && (
        <section className="card p-5">
          <h2 className="text-base font-semibold mb-2">Scoring scale</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {scoringAnchorsText}
          </p>
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold mb-3">The four pillars and their criteria</h2>
        <div className="flex flex-col gap-6">
          {PILLAR_ORDER.map((code) => {
            const pillar = pillars.find((p) => p.pillar_code === code);
            if (!pillar) return null;
            const subcats = subcategoriesByPillar.get(code) ?? [];
            return (
              <div key={code} className="card p-5">
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="text-lg font-semibold">
                    Pillar {code} — {pillar.label}
                  </h3>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    max {pillar.max_points} points
                  </span>
                </div>
                <p className="text-sm italic mb-4" style={{ color: "var(--text-secondary)" }}>
                  {pillar.guiding_question}
                </p>
                <div className="flex flex-col gap-4">
                  {subcats.map((sc) => (
                    <div key={sc.subcategory_code} className="pl-3" style={{ borderLeft: "3px solid var(--series-2)" }}>
                      <div className="text-sm font-semibold mb-1">
                        {sc.subcategory_code} — {sc.label}
                      </div>
                      <p className="text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        {sc.description}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {sc.scoring_anchors}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {supplementary.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">Supplementary scores</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {supplementary.map((s) => (
              <div key={s.name} className="card p-4">
                <div className="font-semibold mb-1">
                  {s.name} — {s.full_name}
                </div>
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {s.description}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  const forecastingContent = (
    <div className="flex flex-col gap-8">
      {vesselEquivalent && (
        <section className="card p-5">
          <h2 className="text-base font-semibold mb-3">100MW vessel equivalents</h2>
          <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
            A {vesselEquivalent.vessel_mw}MW vessel operating continuously for a full year delivers{" "}
            {vesselEquivalent.annual_twh_continuous} TWh/yr ({vesselEquivalent.vessel_mw}MW × 8,760 hours).
          </p>
          <div className="flex flex-col gap-3">
            {vesselEquivalent.conventions.map((c) => (
              <div key={c.name} className="pl-3" style={{ borderLeft: "3px solid var(--series-1)" }}>
                <div className="text-sm font-medium">
                  {c.label} <span style={{ color: "var(--text-muted)" }}>— {c.formula}</span>
                </div>
                <div className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {c.description}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-col gap-4">
          {forecastingSections.map((s) => (
            <div key={s.title} className="card p-5">
              <h3 className="text-base font-semibold mb-2">{s.title}</h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {s.content}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Methodology</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          How the ranking, pillar scores, bottom-up forecasts, and vessel-equivalent conversions on
          the other pages are computed.
        </p>
      </div>
      <MethodologyTabs ranking={rankingContent} forecasting={forecastingContent} />
    </div>
  );
}

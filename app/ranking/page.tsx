import { fetchZoneRanking, fetchZoneRankingExcluded } from "@/lib/db";
import RankingRow from "@/components/RankingRow";
import WorldMap from "@/components/WorldMap";

export default async function RankingPage() {
  const [rows, excluded] = await Promise.all([fetchZoneRanking(), fetchZoneRankingExcluded()]);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold mb-1">Overview</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Candidates ranked by min-pillar score — the weakest of the four pillars (Opportunity size,
        Economics, Feasibility &amp; legality, Durability &amp; trend), deliberately not the mean, so
        one strong pillar can&apos;t mask a fatal weak one. Click a country on the map, or a row
        below, for the underlying detail. See{" "}
        <a href="/methodology" className="underline">
          Methodology
        </a>{" "}
        for the full scoring definitions.
      </p>

      <div className="mb-8">
        <WorldMap ranked={rows} excluded={excluded} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--gridline)" }}>
              <th className="text-left font-medium py-3 px-4">Rank</th>
              <th className="text-left font-medium py-3 px-4">Candidate</th>
              <th className="text-right font-medium py-3 px-4">Min-pillar</th>
              <th className="text-left font-medium py-3 px-4">Binding pillar</th>
              <th className="text-right font-medium py-3 px-4">Mean</th>
              <th className="text-left font-medium py-3 px-4">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <RankingRow key={`${r.rank}-${r.display_name}`} row={r} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  Ranking data not yet loaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {excluded.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold mb-2">Deliberately excluded from this ranking</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {excluded.map((e) => (
              <div key={e.display_name} className="card p-4">
                <div className="font-medium mb-1">{e.display_name}</div>
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {e.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { fetchGeneratorEconomicsCards } from "@/lib/db";

function confidenceColor(confidence: string | null): string {
  if (!confidence) return "var(--text-muted)";
  const c = confidence.toLowerCase();
  if (c.startsWith("full")) return "var(--status-good)";
  if (c.startsWith("not yet cardable")) return "var(--status-critical)";
  return "var(--status-warning)";
}

function additiveColor(value: string | null): string {
  if (!value) return "var(--text-muted)";
  const v = value.toLowerCase();
  if (v.includes("purely additive") || v.startsWith("additive")) return "var(--status-good)";
  if (v.includes("exclusive")) return "var(--status-critical)";
  if (v.includes("not researched") || v.includes("not yet researched")) return "var(--text-muted)";
  return "var(--status-warning)";
}

const COLUMNS: { key: string; label: string; width: string }[] = [
  { key: "zone", label: "Zone", width: "140px" },
  { key: "confidence", label: "Card confidence", width: "160px" },
  { key: "compensation", label: "Compensation regime basis", width: "320px" },
  { key: "additive", label: "Additive vs. exclusive", width: "320px" },
  { key: "floor", label: "Switching floor", width: "280px" },
  { key: "marginal", label: "Marginal cost", width: "220px" },
  { key: "merchant", label: "Merchant / uncontracted share", width: "280px" },
  { key: "legal", label: "Legal path for direct sale", width: "280px" },
  { key: "counterparty", label: "Counterparty", width: "240px" },
  { key: "source", label: "Source", width: "160px" },
];

export default async function GeneratorEconomicsPage() {
  const cards = await fetchGeneratorEconomicsCards();

  return (
    <div className="max-w-none">
      <h1 className="text-2xl font-semibold mb-1">Generator Economics</h1>
      <p className="text-sm mb-6 max-w-3xl" style={{ color: "var(--text-secondary)" }}>
        The "switching floor" per Section 9.58 of the methodology: the minimum price a vessel would
        need to offer a generator to make selling stranded power more attractive than the status
        quo. Built for the top 25 ranked zones. Depth varies a lot by zone — most only have the
        compensation-regime (B1/B2) and legal-path (C1) fields from the ranking scorecard; only 7
        zones have ever had the additive-vs-exclusive question and a counterparty actually resolved.
        See{" "}
        <a href="/methodology" className="underline">
          Methodology
        </a>{" "}
        for the full switching-floor formula.
      </p>

      <div className="card overflow-x-auto">
        <table className="text-sm border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--gridline)" }}>
              {COLUMNS.map((c) => (
                <th key={c.key} className="text-left font-medium py-3 px-3 align-bottom">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.zone_code} style={{ borderTop: "1px solid var(--gridline)" }}>
                <td className="py-3 px-3 align-top font-medium whitespace-normal">
                  <a href={`/evaluation?zone=${encodeURIComponent(card.zone_code)}`} className="hover:underline">
                    {card.display_name}
                  </a>
                </td>
                <td className="py-3 px-3 align-top whitespace-normal">
                  <span className="font-semibold" style={{ color: confidenceColor(card.card_confidence) }}>
                    {card.card_confidence ?? "—"}
                  </span>
                </td>
                <td className="py-3 px-3 align-top whitespace-normal" style={{ color: "var(--text-secondary)" }}>
                  {card.compensation_regime_basis ?? "—"}
                </td>
                <td className="py-3 px-3 align-top whitespace-normal">
                  <div className="font-medium mb-1" style={{ color: additiveColor(card.exclusive_or_additive) }}>
                    {card.exclusive_or_additive ?? "—"}
                  </div>
                  {card.exclusive_or_additive_note && (
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {card.exclusive_or_additive_note}
                    </div>
                  )}
                </td>
                <td className="py-3 px-3 align-top whitespace-normal">
                  <div className="font-medium mb-1">{card.switching_floor_value ?? "—"}</div>
                  {card.switching_floor_note && (
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {card.switching_floor_note}
                    </div>
                  )}
                </td>
                <td className="py-3 px-3 align-top whitespace-normal" style={{ color: "var(--text-secondary)" }}>
                  {card.marginal_cost_note ?? "—"}
                </td>
                <td className="py-3 px-3 align-top whitespace-normal" style={{ color: "var(--text-secondary)" }}>
                  {card.merchant_share_note ?? "—"}
                </td>
                <td className="py-3 px-3 align-top whitespace-normal" style={{ color: "var(--text-secondary)" }}>
                  {card.legal_path_note ?? "—"}
                </td>
                <td className="py-3 px-3 align-top whitespace-normal">
                  <div className="font-medium mb-1">{card.counterparty ?? "—"}</div>
                  {card.counterparty_note && (
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {card.counterparty_note}
                    </div>
                  )}
                </td>
                <td className="py-3 px-3 align-top whitespace-normal text-xs" style={{ color: "var(--text-muted)" }}>
                  {card.source_section ?? "—"}
                </td>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  No generator economics cards loaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

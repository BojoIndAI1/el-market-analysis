"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastYearPoint } from "@/lib/aggregate";

export default function SurplusPerYearChart({ data }: { data: ForecastYearPoint[] }) {
  const hasData = data.some((d) => d.oversupplyTwh !== null);

  if (!hasData) {
    return (
      <div className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
        No forecast data to build the surplus/curtailment chart for the current selection.
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            label={{ value: "TWh", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-hairline)",
              fontSize: 12,
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [typeof value === "number" ? value.toFixed(2) : value, "Surplus / curtailment"]}
          />
          <Bar dataKey="oversupplyTwh" name="Surplus / curtailment" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={(d.oversupplyTwh ?? 0) >= 0 ? "var(--status-good)" : "var(--status-critical)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--status-good)" }} />
          Surplus (oversupply)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--status-critical)" }} />
          Deficit (net importer)
        </span>
      </div>
    </div>
  );
}

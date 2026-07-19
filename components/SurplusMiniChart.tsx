"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ForecastYearPoint } from "@/lib/aggregate";

export default function SurplusMiniChart({ data }: { data: ForecastYearPoint[] }) {
  const hasData = data.some((d) => d.oversupplyTwh !== null);
  if (!hasData) {
    return (
      <div className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
        No forecast data for this selection.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={32} />
        <Tooltip
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-hairline)",
            fontSize: 11,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${Number(value).toFixed(2)} TWh`, "Surplus"]}
        />
        <Bar dataKey="oversupplyTwh" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={(d.oversupplyTwh ?? 0) >= 0 ? "var(--series-1)" : "var(--status-critical)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

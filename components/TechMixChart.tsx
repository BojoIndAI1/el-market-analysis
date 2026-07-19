"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TechMixPoint } from "@/lib/aggregate";

export default function TechMixChart({ data }: { data: TechMixPoint[] }) {
  const hasData = data.some((d) => d.windSolarTwh !== null || d.otherTwh !== null);
  const anyHeldFlat = data.some((d) => d.otherHeldFlat);

  if (!hasData) {
    return (
      <div className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
        Not enough data to build the generation mix for the current selection.
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
            formatter={(value: any) => (typeof value === "number" ? value.toFixed(2) : value)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="windSolarTwh" name="Wind + Solar (dispatched)" stackId="mix" fill="var(--series-1)" isAnimationActive={false} />
          <Bar
            dataKey="otherTwh"
            name="Other generation"
            stackId="mix"
            fill="var(--series-3)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
      {anyHeldFlat && (
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          "Other generation" is only measured through the last historical year available; forecast
          years hold that last known value flat (non-renewable generation isn&apos;t modeled in the
          bottom-up forecast).
        </p>
      )}
    </div>
  );
}

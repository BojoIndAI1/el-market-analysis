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
import { TECH_BUCKET_COLOR } from "@/lib/techBuckets";

export default function TechMixChart({
  data,
  buckets,
}: {
  data: TechMixPoint[];
  buckets: string[];
}) {
  const hasCombinedBucket = buckets.some((b) => b.includes("not split in source"));

  if (data.length === 0 || buckets.length === 0) {
    return (
      <div className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
        No real per-technology generation data for the current selection.
      </div>
    );
  }

  const chartData = data.map((d) => ({ year: d.year, ...d.values }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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
          {buckets.map((bucket, i) => (
            <Bar
              key={bucket}
              dataKey={bucket}
              name={bucket}
              stackId="mix"
              fill={TECH_BUCKET_COLOR[bucket] ?? "var(--series-1)"}
              radius={i === buckets.length - 1 ? [3, 3, 0, 0] : undefined}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        Real per-technology generation (`zone_generation_by_technology`) — granularity varies by
        zone: some report a full fuel-level split (gas/coal/nuclear/hydro/wind/solar/...), others
        only a coarse &quot;Other / conventional&quot; catch-all alongside wind/solar. Only years
        with real data are shown — nothing is held flat or backfilled into forecast years.
        {hasCombinedBucket &&
          " Zones reporting wind/solar (or wind/solar/hydro) as one pre-combined figure show it as its own segment rather than an invented split."}
      </p>
    </div>
  );
}

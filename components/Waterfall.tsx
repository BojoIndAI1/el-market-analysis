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
import type { BridgeStep } from "@/lib/aggregate";

type Row = {
  label: string;
  base: number;
  display: number;
  kind: "total" | "delta";
  sign: "up" | "down" | "flat";
  raw: number;
};

function toRows(steps: BridgeStep[]): Row[] {
  let running = 0;
  return steps.map((step) => {
    const value = step.value ?? 0;
    if (step.kind === "total") {
      running = value;
      return { label: step.label, base: 0, display: value, kind: "total", sign: "flat", raw: value };
    }
    const sign: "up" | "down" | "flat" = value > 0 ? "up" : value < 0 ? "down" : "flat";
    const base = value >= 0 ? running : running + value;
    const display = Math.abs(value);
    running += value;
    return { label: step.label, base, display, kind: "delta", sign, raw: value };
  });
}

function colorFor(row: Row): string {
  if (row.kind === "total") return "var(--series-1)";
  if (row.sign === "up") return "var(--status-good)";
  if (row.sign === "down") return "var(--status-critical)";
  return "var(--baseline)";
}

export default function Waterfall({ steps, unit }: { steps: BridgeStep[]; unit: string }) {
  const rows = toRows(steps);
  const hasData = steps.some((s) => s.value !== null);

  if (!hasData) {
    return (
      <div className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
        Not enough data to build this bridge for the current selection.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          angle={-20}
          textAnchor="end"
          interval={0}
          height={70}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          label={{ value: unit, angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 11 }}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(_value: any, _name: any, ctx: any) => {
            const row = ctx?.payload as Row;
            return [`${row.raw.toFixed(3)} ${unit}`, row.kind === "total" ? "Level" : "Change"];
          }}
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-hairline)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="display" stackId="a" isAnimationActive={false} radius={[4, 4, 4, 4]}>
          {rows.map((row, i) => (
            <Cell key={i} fill={colorFor(row)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import { useState, ReactNode } from "react";

export default function MethodologyTabs({
  ranking,
  forecasting,
}: {
  ranking: ReactNode;
  forecasting: ReactNode;
}) {
  const [tab, setTab] = useState<"ranking" | "forecasting">("ranking");

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--border-hairline)" }}>
        {(
          [
            ["ranking", "Ranking methodology"],
            ["forecasting", "Forecasting methodology"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
            style={{
              borderColor: tab === key ? "var(--series-1)" : "transparent",
              color: tab === key ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "ranking" ? ranking : forecasting}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";

export type SelectableZone = {
  zoneCode: string;
  displayName: string;
};

export default function ZoneMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: SelectableZone[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle(code: string) {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  }

  const label =
    selected.length === 0
      ? "None selected"
      : selected.length === options.length && options.length > 1
      ? `All ${options.length} zones`
      : `${selected.length} zone${selected.length === 1 ? "" : "s"} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-2 rounded-lg text-sm border flex items-center gap-2 min-w-48 justify-between"
        style={{ borderColor: "var(--border-hairline)", background: "var(--surface-1)", color: "var(--text-primary)" }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>▾</span>
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-72 max-h-80 overflow-auto rounded-lg border shadow-lg p-2"
          style={{ borderColor: "var(--border-hairline)", background: "var(--surface-1)" }}
        >
          <div className="flex justify-between px-1 pb-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <button className="underline" onClick={() => onChange(options.map((o) => o.zoneCode))}>
              Select all
            </button>
            <button className="underline" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
          {options.map((opt) => (
            <label
              key={opt.zoneCode}
              className="flex items-center gap-2 px-1 py-1.5 rounded text-sm cursor-pointer"
              style={{ color: "var(--text-primary)" }}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.zoneCode)}
                onChange={() => toggle(opt.zoneCode)}
              />
              {opt.displayName}
            </label>
          ))}
          {options.length === 0 && (
            <div className="px-1 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
              No zones in this selection
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PendingRequest = { id: string; email: string; requested_role: string };

export function ApprovalsList({ initial }: { initial: PendingRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handle(id: string, action: "approve" | "reject") {
    setBusyId(id);
    const supabase = createClient();
    const { error } = await supabase.rpc(
      action === "approve" ? "approve_superuser" : "reject_superuser",
      { target_user_id: id }
    );
    setBusyId(null);
    if (!error) setRequests((r) => r.filter((req) => req.id !== id));
  }

  if (requests.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        No pending requests.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {requests.map((r) => (
        <div key={r.id} className="flex items-center justify-between text-sm card p-3">
          <div>
            <div>{r.email}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              requesting {r.requested_role}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              disabled={busyId === r.id}
              onClick={() => handle(r.id, "approve")}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              style={{ background: "var(--status-good)" }}
            >
              Approve
            </button>
            <button
              disabled={busyId === r.id}
              onClick={() => handle(r.id, "reject")}
              className="rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-60"
              style={{ border: "1px solid var(--border-hairline)", color: "var(--text-secondary)" }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

type PageAccessRow = { page_key: string; label: string; requires_login: boolean };

export function PageAccessToggles({ initial }: { initial: PageAccessRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function toggle(pageKey: string, next: boolean) {
    setBusyKey(pageKey);
    const supabase = createClient();
    const { error } = await supabase
      .from("page_access")
      .update({ requires_login: next, updated_at: new Date().toISOString() })
      .eq("page_key", pageKey);
    setBusyKey(null);
    if (!error) {
      setRows((rs) => rs.map((r) => (r.page_key === pageKey ? { ...r, requires_login: next } : r)));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <label key={r.page_key} className="flex items-center justify-between text-sm card p-3 cursor-pointer">
          <span>{r.label}</span>
          <span className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {r.requires_login ? "Requires login" : "Public"}
            </span>
            <input
              type="checkbox"
              checked={r.requires_login}
              disabled={busyKey === r.page_key}
              onChange={(e) => toggle(r.page_key, e.target.checked)}
            />
          </span>
        </label>
      ))}
    </div>
  );
}

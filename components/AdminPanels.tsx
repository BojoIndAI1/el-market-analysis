"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PAGE_MIN_ROLE_OPTIONS, type PageMinRole } from "@/lib/pageAccess";

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

type PageAccessRow = { page_key: string; label: string; min_role: PageMinRole };

export function PageAccessToggles({ initial }: { initial: PageAccessRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function setMinRole(pageKey: string, next: PageMinRole) {
    setBusyKey(pageKey);
    const supabase = createClient();
    const label = rows.find((r) => r.page_key === pageKey)?.label ?? pageKey;
    // Upsert, not update -- a page just added to PAGE_ACCESS_KEYS (lib/pageAccess.ts) has no
    // page_access row yet, so a plain .update() would silently affect zero rows the first time
    // an admin tries to configure it.
    const { error } = await supabase
      .from("page_access")
      .upsert(
        { page_key: pageKey, label, min_role: next, updated_at: new Date().toISOString() },
        { onConflict: "page_key" }
      );
    setBusyKey(null);
    if (!error) {
      setRows((rs) => rs.map((r) => (r.page_key === pageKey ? { ...r, min_role: next } : r)));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.page_key} className="flex items-center justify-between text-sm card p-3">
          <span>{r.label}</span>
          <select
            value={r.min_role}
            disabled={busyKey === r.page_key}
            onChange={(e) => setMinRole(r.page_key, e.target.value as PageMinRole)}
            className="rounded-md border px-2 py-1 text-xs capitalize"
            style={{ borderColor: "var(--border-hairline)", background: "var(--page-plane)" }}
          >
            {PAGE_MIN_ROLE_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="capitalize">
                {opt === "public" ? "Public (no login)" : `${opt} and above`}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

type UserRow = {
  id: string;
  email: string;
  role: PageMinRole;
  approved: boolean;
  requested_role: string | null;
  created_at: string;
};

const ASSIGNABLE_ROLES = ["user", "superuser", "admin"] as const;

export function UsersList({
  initial,
  currentUserId,
}: {
  initial: UserRow[];
  currentUserId: string;
}) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setRole(id: string, newRole: (typeof ASSIGNABLE_ROLES)[number]) {
    setBusyId(id);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_role", {
      target_user_id: id,
      new_role: newRole,
    });
    setBusyId(null);
    if (!error) {
      setRows((rs) =>
        rs.map((r) => (r.id === id ? { ...r, role: newRole, requested_role: null } : r))
      );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between text-sm card p-3">
          <div>
            <div>{r.email}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              joined {new Date(r.created_at).toLocaleDateString()}
              {r.requested_role && (
                <span style={{ color: "var(--status-warning)" }}> · requested {r.requested_role}</span>
              )}
            </div>
          </div>
          <select
            value={r.role}
            disabled={busyId === r.id || r.id === currentUserId}
            onChange={(e) => setRole(r.id, e.target.value as (typeof ASSIGNABLE_ROLES)[number])}
            className="rounded-md border px-2 py-1 text-xs capitalize"
            style={{ borderColor: "var(--border-hairline)", background: "var(--page-plane)" }}
            title={r.id === currentUserId ? "You can't change your own role" : undefined}
          >
            {ASSIGNABLE_ROLES.map((opt) => (
              <option key={opt} value={opt} className="capitalize">
                {opt}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

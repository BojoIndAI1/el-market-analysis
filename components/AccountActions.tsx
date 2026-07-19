"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="rounded-md px-3 py-2 text-sm font-medium"
      style={{ border: "1px solid var(--border-hairline)", color: "var(--text-secondary)" }}
    >
      Log out
    </button>
  );
}

export function RequestSuperuserButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("request_superuser");
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--series-1)" }}
      >
        {loading ? "Requesting…" : "Request Superuser access"}
      </button>
      {error && (
        <p className="text-xs" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

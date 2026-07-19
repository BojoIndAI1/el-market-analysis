"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [wantsSuperuser, setWantsSuperuser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: wantsSuperuser ? { data: { requested_role: "superuser" } } : undefined,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/");
      router.refresh();
    } else {
      setConfirmSent(true);
    }
  }

  if (confirmSent) {
    return (
      <div className="max-w-sm mx-auto mt-16 card p-6">
        <h1 className="text-lg font-semibold mb-2">Check your email</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          We sent a confirmation link to {email}. Click it to activate your account, then log in.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-16 card p-6">
      <h1 className="text-lg font-semibold mb-4">Sign up</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-sm">
          <span className="block mb-1" style={{ color: "var(--text-secondary)" }}>
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border-hairline)", background: "var(--page-plane)" }}
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1" style={{ color: "var(--text-secondary)" }}>
            Password
          </span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border-hairline)", background: "var(--page-plane)" }}
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={wantsSuperuser}
            onChange={(e) => setWantsSuperuser(e.target.checked)}
            className="mt-0.5"
          />
          <span style={{ color: "var(--text-secondary)" }}>
            Request SuperUser access (subject to admin approval)
          </span>
        </label>
        {error && (
          <p className="text-sm" style={{ color: "var(--status-critical)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "var(--series-1)" }}
        >
          {loading ? "Signing up…" : "Sign up"}
        </button>
      </form>
      <p className="text-sm mt-4" style={{ color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--series-1)" }}>
          Log in
        </Link>
      </p>
    </div>
  );
}

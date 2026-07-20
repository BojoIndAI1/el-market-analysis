"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/ranking", label: "Overview" },
  { href: "/scorecard", label: "Scorecard" },
  { href: "/data", label: "Data" },
  { href: "/evaluation", label: "Evaluation" },
  { href: "/generator-economics", label: "Generator Economics" },
  { href: "/methodology", label: "Methodology" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <aside
      className="w-56 shrink-0 h-screen sticky top-0 flex flex-col border-r"
      style={{ borderColor: "var(--border-hairline)", background: "var(--surface-1)" }}
    >
      <div className="px-5 py-6">
        <div className="text-sm font-semibold tracking-wide" style={{ color: "var(--text-primary)" }}>
          Maritime Data Center
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Market Research
        </div>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: active ? "var(--series-1)" : "transparent",
                color: active ? "#ffffff" : "var(--text-secondary)",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div
        className="mt-auto px-3 py-4"
        style={{ borderTop: "1px solid var(--border-hairline)" }}
      >
        {email === undefined ? null : email ? (
          <Link
            href="/account"
            className="block px-3 py-2 rounded-lg text-sm font-medium truncate hover:underline"
            style={{ color: "var(--text-secondary)" }}
            title={email}
          >
            {email}
          </Link>
        ) : (
          <Link
            href="/login"
            className="block text-center px-3 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--series-1)" }}
          >
            Log in
          </Link>
        )}
      </div>
    </aside>
  );
}

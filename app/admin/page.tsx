import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { PAGE_ACCESS_KEYS } from "@/lib/pageAccess";
import { ApprovalsList, PageAccessToggles, UsersList } from "@/components/AdminPanels";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/admin");
  if (profile.role !== "admin") redirect("/account");

  const supabase = await createClient();
  const [{ data: pending }, { data: pageAccessRows }, { data: users }] = await Promise.all([
    supabase.from("profiles").select("id, email, requested_role").not("requested_role", "is", null),
    supabase.from("page_access").select("page_key, label, min_role"),
    supabase
      .from("profiles")
      .select("id, email, role, approved, requested_role, created_at")
      .order("created_at", { ascending: false }),
  ]);

  // Always show every page the code currently knows about (PAGE_ACCESS_KEYS), not just whatever
  // rows happen to already exist in Supabase -- a newly added page (like /scorecard) shouldn't
  // require a manual DB insert before an admin can even see and configure it. Anything missing
  // defaults to "user" for display only; PageAccessToggles' own update upserts the real row the
  // first time an admin actually changes it.
  const pageAccessByKey = new Map((pageAccessRows ?? []).map((r) => [r.page_key, r]));
  const pageAccess = PAGE_ACCESS_KEYS.map(({ key, label }) => {
    const existing = pageAccessByKey.get(key);
    return {
      page_key: key,
      label: existing?.label ?? label,
      min_role: existing?.min_role ?? "user",
    };
  });

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold mb-1">Admin</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Approve superuser requests, control which role each section requires, and manage users.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2">Pending approvals</h2>
        <ApprovalsList initial={pending ?? []} />
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Section access</h2>
        <PageAccessToggles initial={pageAccess ?? []} />
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Users</h2>
        <UsersList initial={users ?? []} currentUserId={profile.id} />
      </section>
    </div>
  );
}

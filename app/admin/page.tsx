import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { ApprovalsList, PageAccessToggles } from "@/components/AdminPanels";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/admin");
  if (profile.role !== "admin") redirect("/account");

  const supabase = await createClient();
  const [{ data: pending }, { data: pageAccess }] = await Promise.all([
    supabase.from("profiles").select("id, email, requested_role").not("requested_role", "is", null),
    supabase.from("page_access").select("page_key, label, requires_login").order("page_key"),
  ]);

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold mb-1">Admin</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Approve superuser requests and control which sections require login.
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
    </div>
  );
}

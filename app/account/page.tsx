import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { LogoutButton, RequestSuperuserButton } from "@/components/AccountActions";

export default async function AccountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/account");

  return (
    <div className="max-w-md card p-6">
      <h1 className="text-lg font-semibold mb-4">Account</h1>
      <dl className="flex flex-col gap-2 text-sm mb-5">
        <div className="flex justify-between">
          <dt style={{ color: "var(--text-muted)" }}>Email</dt>
          <dd>{profile.email}</dd>
        </div>
        <div className="flex justify-between">
          <dt style={{ color: "var(--text-muted)" }}>Role</dt>
          <dd className="capitalize">{profile.role}</dd>
        </div>
        {profile.requested_role && (
          <div className="flex justify-between">
            <dt style={{ color: "var(--text-muted)" }}>Pending request</dt>
            <dd className="capitalize" style={{ color: "var(--status-warning)" }}>
              {profile.requested_role} (awaiting admin approval)
            </dd>
          </div>
        )}
      </dl>

      <div className="flex flex-col gap-3">
        {profile.role === "user" && !profile.requested_role && <RequestSuperuserButton />}
        {profile.role === "admin" && (
          <Link
            href="/admin"
            className="rounded-md px-3 py-2 text-sm font-medium text-white text-center"
            style={{ background: "var(--series-1)" }}
          >
            Admin dashboard
          </Link>
        )}
        <LogoutButton />
      </div>
    </div>
  );
}

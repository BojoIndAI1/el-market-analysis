import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { PAGE_ACCESS_KEYS, ROLE_LEVEL, type PageMinRole } from "@/lib/pageAccess";

export async function proxy(request: NextRequest) {
  const { supabaseResponse, supabase, user } = await updateSession(request);

  const path = request.nextUrl.pathname;
  const pageKey = PAGE_ACCESS_KEYS.find(
    ({ key }) => path === `/${key}` || path.startsWith(`/${key}/`)
  )?.key;

  if (pageKey) {
    const { data } = await supabase
      .from("page_access")
      .select("min_role")
      .eq("page_key", pageKey)
      .maybeSingle();
    const minRole = (data?.min_role as PageMinRole | undefined) ?? "public";

    if (minRole !== "public") {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", path);
        return NextResponse.redirect(url);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const userLevel = profile ? ROLE_LEVEL[profile.role as PageMinRole] : 0;

      if (userLevel < ROLE_LEVEL[minRole]) {
        const url = request.nextUrl.clone();
        url.pathname = "/account";
        url.searchParams.set("denied", pageKey);
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|login|signup).*)"],
};

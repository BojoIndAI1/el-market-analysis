import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { PAGE_ACCESS_KEYS } from "@/lib/pageAccess";

export async function proxy(request: NextRequest) {
  const { supabaseResponse, supabase, user } = await updateSession(request);

  const path = request.nextUrl.pathname;
  const pageKey = PAGE_ACCESS_KEYS.find(
    ({ key }) => path === `/${key}` || path.startsWith(`/${key}/`)
  )?.key;

  if (pageKey && !user) {
    const { data } = await supabase
      .from("page_access")
      .select("requires_login")
      .eq("page_key", pageKey)
      .maybeSingle();

    if (data?.requires_login) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|login|signup).*)"],
};

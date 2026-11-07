import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isUserRole, dashboardPath } from "@/lib/auth/roles";
import { requiredRoleForPath } from "@/lib/security/access";
import { getSupabaseEnvironment } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  const { url, anonKey } = getSupabaseEnvironment();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error && error.status !== 400 && error.status !== 401) {
    throw new Error(`Unable to refresh the Supabase session: ${error.message}`);
  }
  if (!data.user) {
    return redirectWithSession(request, response, "/login");
  }

  const profile = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile.error && profile.data && !profile.data.is_active) {
    return redirectWithSession(request, response, "/login", "?inactive=1");
  }
  if (!profile.error && profile.data && isUserRole(profile.data.role)) {
    const required = requiredRoleForPath(request.nextUrl.pathname);
    if (required && profile.data.role !== required) {
      return redirectWithSession(request, response, dashboardPath(profile.data.role));
    }
  }

  return response;
}

function redirectWithSession(request: NextRequest, response: NextResponse, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export const config = {
  matcher: ["/dashboard/:path*", "/account/:path*"],
};

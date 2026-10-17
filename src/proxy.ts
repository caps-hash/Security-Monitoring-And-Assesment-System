import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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

  const { error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(`Unable to refresh the Supabase session: ${error.message}`);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

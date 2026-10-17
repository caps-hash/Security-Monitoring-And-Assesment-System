import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnvironment } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnvironment();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("Cookies can only be modified")
          ) {
            return;
          }
          throw error;
        }
      },
    },
  });
}

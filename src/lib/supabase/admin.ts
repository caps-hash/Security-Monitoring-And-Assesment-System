import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnvironment } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error(
      "Supabase admin configuration error: set SUPABASE_SERVICE_ROLE_KEY on the server to invite staff accounts.",
    );
  }

  const { url } = getSupabaseEnvironment();
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

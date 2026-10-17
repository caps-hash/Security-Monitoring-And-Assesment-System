"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnvironment } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseEnvironment();
  return createBrowserClient<Database>(url, anonKey);
}

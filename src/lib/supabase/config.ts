export type SupabaseEnvironment = {
  url: string;
  anonKey: string;
};

export function getSupabaseEnvironmentError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.";
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return "NEXT_PUBLIC_SUPABASE_URL must use HTTP or HTTPS.";
    }
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL must be a valid URL.";
  }

  return null;
}

export function getSupabaseEnvironment(): SupabaseEnvironment {
  const error = getSupabaseEnvironmentError();
  if (error) {
    throw new Error(`Supabase configuration error: ${error}`);
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
  };
}

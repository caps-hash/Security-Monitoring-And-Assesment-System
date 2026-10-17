import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/app/login/login-form";
import { getSupabaseEnvironmentError } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
  const { inactive } = await searchParams;
  const configurationError = getSupabaseEnvironmentError();

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link
          className="text-sm font-semibold text-blue-900 hover:text-blue-700"
          href="/"
        >
          GGF Security
        </Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-blue-800">
          Personnel Assessment System
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
          Sign in to your account
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use your agency account to access your role-specific dashboard.
        </p>
        {inactive === "1" ? (
          <p
            className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
            role="status"
          >
            This account is inactive. Contact HR for assistance.
          </p>
        ) : null}
        {configurationError ? (
          <p
            className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
            role="status"
          >
            Supabase is not configured. {configurationError}
          </p>
        ) : (
          <LoginForm />
        )}
      </section>
    </main>
  );
}

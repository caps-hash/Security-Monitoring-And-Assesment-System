"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Email address
        </label>
        <input
          autoComplete="email"
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Password
        </label>
        <input
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      {state.error ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <button
        className="w-full rounded-lg bg-blue-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

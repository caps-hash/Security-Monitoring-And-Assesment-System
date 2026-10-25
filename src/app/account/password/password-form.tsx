"use client";

import { useActionState } from "react";
import {
  replaceTemporaryPassword,
  type RequiredPasswordState,
} from "@/app/account/password/actions";

const initialState: RequiredPasswordState = { error: null };

export function RequiredPasswordForm() {
  const [state, formAction, pending] = useActionState(
    replaceTemporaryPassword,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block text-sm font-semibold text-slate-700">
        Temporary password
        <input
          autoComplete="current-password"
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
          name="current_password"
          required
          type="password"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        New password
        <input
          autoComplete="new-password"
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
          minLength={6}
          name="new_password"
          required
          type="password"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Confirm new password
        <input
          autoComplete="new-password"
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
          minLength={6}
          name="confirm_password"
          required
          type="password"
        />
      </label>
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
        className="w-full rounded-lg bg-blue-900 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Updating..." : "Change password"}
      </button>
    </form>
  );
}

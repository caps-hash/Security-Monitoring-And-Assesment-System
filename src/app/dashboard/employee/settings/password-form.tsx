"use client";

import { useActionState } from "react";
import {
  changePassword,
  type PasswordState,
} from "@/app/dashboard/employee/settings/actions";

const initialState: PasswordState = { error: null, success: null };

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="mt-5 max-w-md space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Current password
        <input
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
          name="current_password"
          required
          type="password"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        New password
        <input
          autoComplete="new-password"
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
          minLength={6}
          name="new_password"
          required
          type="password"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Confirm new password
        <input
          autoComplete="new-password"
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
          minLength={6}
          name="confirm_password"
          required
          type="password"
        />
      </label>
      <p className="text-xs leading-5 text-slate-500">
        Use at least 6 characters. This matches the default Supabase password
        length. The password is stored by Supabase Authentication, not in the
        personnel tables.
      </p>
      {state.error ? (
        <p aria-live="polite" className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p aria-live="polite" className="text-sm text-emerald-700" role="status">
          {state.success}
        </p>
      ) : null}
      <button
        className="rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
}

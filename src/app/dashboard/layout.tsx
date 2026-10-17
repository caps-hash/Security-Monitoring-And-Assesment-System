import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions";

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link className="text-sm font-bold tracking-tight text-blue-950" href="/">
            GGF <span className="font-medium text-slate-500">/ Security Personnel</span>
          </Link>
          <nav
            aria-label="Account navigation"
            className="flex items-center gap-5 text-sm"
          >
            <Link className="font-medium text-slate-600 hover:text-blue-900" href="/">
              Home
            </Link>
            <form action={signOut}>
              <button
                className="font-semibold text-blue-900 hover:text-blue-700"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">{children}</main>
    </div>
  );
}

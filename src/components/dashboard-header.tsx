"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions";

export function DashboardHeader() {
  const pathname = usePathname();
  const hasSidebarLogout =
    pathname.startsWith("/dashboard/employee") ||
    pathname.startsWith("/dashboard/hr") ||
    pathname.startsWith("/dashboard/supervisor");

  return (
    <nav
      aria-label="Account navigation"
      className="flex items-center gap-5 text-sm"
    >
      <Link className="font-medium text-slate-600 hover:text-blue-900" href="/">
        Home
      </Link>
      {!hasSidebarLogout ? (
        <form action={signOut}>
          <button
            className="font-semibold text-blue-900 hover:text-blue-700"
            type="submit"
          >
            Sign out
          </button>
        </form>
      ) : null}
    </nav>
  );
}

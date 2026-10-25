"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut } from "@/app/actions";
import { DashboardHeader } from "@/components/dashboard-header";

export type SidebarIconName =
  | "dashboard"
  | "profile"
  | "assignment"
  | "assessment"
  | "dtr"
  | "settings"
  | "password"
  | "personnel"
  | "duty";

export type SidebarNavItem = {
  label: string;
  href: string;
  icon: SidebarIconName;
};

const iconPaths: Record<SidebarIconName | "logout", string> = {
  dashboard: "M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z",
  profile: "M20 21a8 8 0 0 0-16 0 M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  assignment: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  assessment: "M4 19V5 M4 19h17 M8 15l3-4 3 2 5-7",
  dtr: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.8 0l-.2.1h-3.4l-.1-.2a1.7 1.7 0 0 0-1.5-.9 1.7 1.7 0 0 0-1.5.9l-.1.2H6l-.2-.1a1.7 1.7 0 0 0-1.8 0l-.2.1-1.7-2.9.1-.1A1.7 1.7 0 0 0 2.5 15l-.1-.2v-3.4l.2-.1a1.7 1.7 0 0 0 .9-1.5 1.7 1.7 0 0 0-.9-1.5l-.2-.1V4.8l.1-.2a1.7 1.7 0 0 0 0-1.8L2.4 2.6l2.9-1.7.1.1a1.7 1.7 0 0 0 1.9.3l.2-.1h3.4l.1.2a1.7 1.7 0 0 0 1.5.9 1.7 1.7 0 0 0 1.5-.9l.1-.2h3.4l.2.1a1.7 1.7 0 0 0 1.8 0l.2-.1 1.7 2.9-.1.1a1.7 1.7 0 0 0-.3 1.9l.1.2v3.4l-.2.1a1.7 1.7 0 0 0-.9 1.5 1.7 1.7 0 0 0 .9 1.5l.2.1v3.4Z",
  password: "M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5z M12 14v3",
  personnel:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  duty: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  logout: "M10 17l5-5-5-5 M15 12H3 M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6",
};

function SidebarIcon({ name }: { name: SidebarIconName | "logout" }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

export function RoleSidebar({
  items,
  navigationLabel,
  pagesLabel,
  menuId,
  children,
}: {
  items: SidebarNavItem[];
  navigationLabel: string;
  pagesLabel: string;
  menuId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="md:h-dvh md:overflow-hidden">

      {mobileOpen ? (
        <button
          aria-label={`Close ${navigationLabel.toLowerCase()}`}
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        aria-label={navigationLabel}
        className={`${mobileOpen ? "z-50 flex w-72" : "hidden"} fixed top-0 left-0 h-dvh flex-col overflow-hidden bg-slate-950 p-4 text-slate-100 shadow-lg md:z-30 md:flex ${collapsed ? "md:w-20" : "md:w-64"}`}
        id={menuId}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div className={collapsed ? "md:sr-only" : ""}>
            <p className="text-lg font-bold tracking-wide text-white">GGF</p>
            <p className="mt-0.5 text-xs text-slate-300">Security Personnel</p>
          </div>
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
            type="button"
          >
            <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
          </button>
          <button
            aria-label={`Close ${navigationLabel.toLowerCase()}`}
            className="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:hidden"
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <nav aria-label={pagesLabel} className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const isActive = !item.href.includes("#") && pathname === item.href;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  isActive
                    ? "bg-blue-700 text-white shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                href={item.href}
                key={item.label}
                onClick={() => setMobileOpen(false)}
                title={item.label}
              >
                <SidebarIcon name={item.icon} />
                <span className={collapsed ? "md:sr-only" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <form action={signOut} className="shrink-0 border-t border-white/10 pt-3">
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            title="Log out"
            type="submit"
          >
            <SidebarIcon name="logout" />
            <span className={collapsed ? "md:sr-only" : ""}>Logout</span>
          </button>
        </form>
      </aside>
      <div
        className={`flex min-h-dvh flex-col md:h-dvh md:overflow-hidden ${collapsed ? "md:pl-20" : "md:pl-64"}`}
      >
        <header className="shrink-0 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <Link className="text-sm font-bold tracking-tight text-blue-950" href="/">
              GGF <span className="font-medium text-slate-500">/ Security Personnel</span>
            </Link>
            <DashboardHeader />
          </div>
        </header>
        <div className="min-w-0 flex-1 md:overflow-y-auto">
          <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
            <div className="mb-4 flex items-center justify-between md:hidden">
              <span className="text-sm font-semibold text-slate-700">{navigationLabel}</span>
              <button
                aria-controls={menuId}
                aria-expanded={mobileOpen}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
                onClick={() => setMobileOpen((open) => !open)}
                type="button"
              >
                {mobileOpen ? "Close menu" : "Open menu"}
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

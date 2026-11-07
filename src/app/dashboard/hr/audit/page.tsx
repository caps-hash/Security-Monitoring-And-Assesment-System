import type { Metadata } from "next";
import Link from "next/link";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireRole } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Audit log",
};

const PAGE_SIZE = 25;

export default async function HrAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole("hr");
  const params = await searchParams;
  const filters = readFilters(params);
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, action_type, record_type, record_id, summary, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1);
  if (filters.action) {
    query = query.eq("action_type", filters.action);
  }
  if (filters.actor) {
    query = query.eq("actor_id", filters.actor);
  }
  if (filters.from) {
    query = query.gte("created_at", `${filters.from}T00:00:00+08:00`);
  }
  if (filters.to) {
    query = query.lte("created_at", `${filters.to}T23:59:59+08:00`);
  }
  if (filters.q) {
    query = query.ilike("summary", `%${filters.q.replace(/[%_]/g, "")}%`);
  }
  const result = await query;
  const missing = Boolean(result.error && /audit_logs|schema cache|does not exist/i.test(result.error.message));
  const actorIds = [...new Set((result.data ?? []).flatMap((row) => (row.actor_id ? [row.actor_id] : [])))];
  const actors = actorIds.length
    ? await supabase.from("profiles").select("id, first_name, last_name, email").in("id", actorIds)
    : { data: [] };
  const names = new Map((actors.data ?? []).map((actor) => [actor.id, [actor.first_name, actor.last_name].filter(Boolean).join(" ") || actor.email]));
  const pages = Math.max(1, Math.ceil((result.count ?? 0) / PAGE_SIZE));

  return (
    <DashboardPlaceholder profile={profile} role="hr">
      <section aria-labelledby="audit-heading">
        <h2 className="text-lg font-semibold text-slate-900" id="audit-heading">Audit log</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          HR can review important account, personnel, assessment, attendance, and SMS events. Passwords and provider credentials are not stored here.
        </p>
        <form action="/dashboard/hr/audit" className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">From<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={filters.from} name="from" type="date" /></label>
          <label className="text-sm font-medium text-slate-700">To<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={filters.to} name="to" type="date" /></label>
          <label className="text-sm font-medium text-slate-700">Action<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={filters.action} name="action" /></label>
          <label className="text-sm font-medium text-slate-700">Search<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={filters.q} name="q" /></label>
          <button className="w-fit rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white" type="submit">Apply filters</button>
        </form>
        {missing ? <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Audit logs are unavailable until the Phase 9 migration is applied.</p> : null}
        {result.error && !missing ? <p className="mt-4 text-sm text-red-700">The audit log could not be loaded.</p> : null}
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Record</th>
                <th className="px-3 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {(result.data ?? []).length ? (result.data ?? []).map((row) => (
                <tr className="border-t border-slate-100" key={row.id}>
                  <td className="px-3 py-2">{row.created_at.slice(0, 16)}</td>
                  <td className="px-3 py-2">{row.actor_id ? names.get(row.actor_id) ?? "User" : "System"}</td>
                  <td className="px-3 py-2">{row.action_type}</td>
                  <td className="px-3 py-2">{row.record_type}{row.record_id ? ` ${row.record_id.slice(0, 8)}` : ""}</td>
                  <td className="px-3 py-2">{row.summary}</td>
                </tr>
              )) : (
                <tr><td className="px-3 py-4 text-slate-600" colSpan={5}>No audit events match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Page {filters.page} of {pages}.{" "}
          {filters.page > 1 ? <Link className="font-semibold text-blue-800" href={pageHref(filters, filters.page - 1)}>Previous</Link> : null}{" "}
          {filters.page < pages ? <Link className="font-semibold text-blue-800" href={pageHref(filters, filters.page + 1)}>Next</Link> : null}
        </p>
      </section>
    </DashboardPlaceholder>
  );
}

function readFilters(params: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const page = Number(first(params.page));
  return {
    from: /^\d{4}-\d{2}-\d{2}$/.test(first(params.from)) ? first(params.from) : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(first(params.to)) ? first(params.to) : "",
    action: first(params.action).slice(0, 80),
    actor: /^[0-9a-f-]{36}$/i.test(first(params.actor)) ? first(params.actor) : "",
    q: first(params.q).slice(0, 80),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function pageHref(filters: ReturnType<typeof readFilters>, page: number): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.action) params.set("action", filters.action);
  if (filters.q) params.set("q", filters.q);
  params.set("page", String(page));
  return `/dashboard/hr/audit?${params.toString()}`;
}

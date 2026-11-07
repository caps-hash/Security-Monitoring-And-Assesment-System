import type { Metadata } from "next";
import Link from "next/link";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { PrintReportButton } from "@/components/print-report-button";
import { RankingWeightsForm } from "@/components/ranking-weights-form";
import { manilaDateKey } from "@/lib/attendance/policy";
import { requireRole } from "@/lib/auth/profile";
import { loadReportSnapshot } from "@/lib/reports/load";
import {
  EXPORT_LIMIT,
  PAGE_SIZE,
  REPORT_IDS,
  buildReport,
  paginateRows,
  readReportFilters,
  relevantFilters,
  reportTitle,
  type ReportFilters,
} from "@/lib/reports/model";

export const metadata: Metadata = {
  title: "Reports and analytics",
};

export default async function HrReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole("hr");
  const params = await searchParams;
  const filters = readReportFilters(params, manilaDateKey(new Date()));
  const loaded = await loadReportSnapshot(filters);
  const table = buildReport(loaded.snapshot, filters);
  const page = paginateRows(table.rows, filters.page, PAGE_SIZE);
  const visibleFilters = new Set(relevantFilters(filters.report));
  const exportQuery = exportSearch(filters);

  return (
    <DashboardPlaceholder profile={profile} role="hr">
      <section aria-labelledby="reports-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900" id="reports-heading">
              Reports and analytics
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              HR-only reports use the saved attendance, assessment, decision, and SMS records.
              Opening a report does not send SMS or change an employment decision.
            </p>
          </div>
          <p className="text-xs text-slate-500">Generated {loaded.snapshot.generatedAt.slice(0, 16)} UTC</p>
        </div>

        <nav aria-label="Report types" className="print-hidden mt-4 flex flex-wrap gap-2">
          {REPORT_IDS.map((report) => (
            <Link
              className={`rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 ${
                filters.report === report ? "bg-blue-800 text-white" : "border border-slate-300 bg-white text-slate-800"
              }`}
              href={`/dashboard/hr/reports?report=${report}`}
              key={report}
            >
              {reportTitle(report)}
            </Link>
          ))}
        </nav>

        <form action="/dashboard/hr/reports" className="print-hidden mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4">
          <input name="report" type="hidden" value={filters.report} />
          {visibleFilters.has("from") ? <Filter label="From" name="from" type="date" value={filters.from} /> : null}
          {visibleFilters.has("to") ? <Filter label="To" name="to" type="date" value={filters.to} /> : null}
          {visibleFilters.has("employeeId") ? <Select label="Employee" name="employee" options={loaded.options.employees} value={filters.employeeId} /> : null}
          {visibleFilters.has("supervisorId") ? <Select label="Supervisor" name="supervisor" options={loaded.options.supervisors} value={filters.supervisorId} /> : null}
          {visibleFilters.has("postId") ? <Select label="Post" name="post" options={loaded.options.posts} value={filters.postId} /> : null}
          {visibleFilters.has("locationId") ? <Select label="Location" name="location" options={loaded.options.locations} value={filters.locationId} /> : null}
          {visibleFilters.has("shiftId") ? <Select label="Shift" name="shift" options={loaded.options.shifts} value={filters.shiftId} /> : null}
          {visibleFilters.has("status") ? <Filter label="Status" name="status" value={filters.status} /> : null}
          {visibleFilters.has("rating") ? <Select label="Rating" name="rating" options={loaded.options.ratings.map((rating) => ({ id: rating, name: rating }))} value={filters.rating} /> : null}
          {visibleFilters.has("q") ? <Filter label="Search" name="q" value={filters.q} /> : null}
          <div className="flex items-end">
            <button className="rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800" type="submit">
              Apply filters
            </button>
          </div>
        </form>

        {loaded.snapshot.warning ? <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{loaded.snapshot.warning}</p> : null}
        {table.error ? <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{table.error}</p> : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{table.title}</h3>
          <div className="print-hidden flex flex-wrap gap-2">
            <PrintReportButton />
            <ExportLink href={`/api/reports/export?format=csv&${exportQuery}`} label="CSV" />
            <ExportLink href={`/api/reports/export?format=xlsx&${exportQuery}`} label="Excel" />
            <ExportLink href={`/api/reports/export?format=pdf&${exportQuery}`} label="PDF" />
          </div>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {table.summary.map((item) => (
            <div className="rounded-lg border border-slate-200 bg-white p-3" key={item.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt>
              <dd className="mt-1 text-xl font-bold text-slate-950">{item.value}</dd>
            </div>
          ))}
        </dl>
        {table.notes.map((note) => <p className="mt-3 text-sm text-slate-600" key={note}>{note}</p>)}
        {table.rows.length > EXPORT_LIMIT ? <p className="mt-3 text-sm text-amber-800">Exports are limited to {EXPORT_LIMIT} rows. Narrow the filters first.</p> : null}

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {table.columns.map((column) => (
                  <th className="px-3 py-2 font-semibold" key={column.key} scope="col">
                    <Link href={sortHref(filters, column.key)}>{column.label}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.rows.length ? page.rows.map((row, index) => (
                <tr className="border-t border-slate-100" key={`${row.employeeNumber ?? row.recipient ?? "row"}-${index}`}>
                  {table.columns.map((column) => <td className="px-3 py-2 text-slate-800" key={column.key}>{row[column.key]}</td>)}
                </tr>
              )) : (
                <tr>
                  <td className="px-3 py-4 text-slate-600" colSpan={Math.max(table.columns.length, 1)}>No rows match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="print-hidden mt-3 text-sm text-slate-600">
          Page {page.page} of {page.pages}.{" "}
          {page.page > 1 ? <Link className="font-semibold text-blue-800" href={pageHref(filters, page.page - 1)}>Previous</Link> : null}{" "}
          {page.page < page.pages ? <Link className="font-semibold text-blue-800" href={pageHref(filters, page.page + 1)}>Next</Link> : null}
        </p>

        {filters.report === "performers" ? (
          <RankingWeightsForm
            approved={loaded.snapshot.ranking?.approved ?? false}
            assessmentWeight={loaded.snapshot.ranking?.assessmentWeight?.toString() ?? ""}
            attendanceWeight={loaded.snapshot.ranking?.attendanceWeight?.toString() ?? ""}
            sourceNote={loaded.snapshot.ranking?.sourceNote ?? ""}
          />
        ) : null}
      </section>
    </DashboardPlaceholder>
  );
}

function Filter({ label, name, value, type = "text" }: { label: string; name: string; value: string; type?: string }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={value} name={name} type={type} />
    </label>
  );
}

function Select({ label, name, options, value }: { label: string; name: string; options: { id: string; name: string }[]; value: string }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={value} name={name}>
        <option value="">All</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}

function ExportLink({ href, label }: { href: string; label: string }) {
  return <a className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50" href={href}>{label}</a>;
}

function exportSearch(filters: ReportFilters): string {
  const params = new URLSearchParams();
  params.set("report", filters.report);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.employeeId) params.set("employee", filters.employeeId);
  if (filters.supervisorId) params.set("supervisor", filters.supervisorId);
  if (filters.postId) params.set("post", filters.postId);
  if (filters.locationId) params.set("location", filters.locationId);
  if (filters.shiftId) params.set("shift", filters.shiftId);
  if (filters.status) params.set("status", filters.status);
  if (filters.rating) params.set("rating", filters.rating);
  if (filters.q) params.set("q", filters.q);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.direction === "desc") params.set("direction", "desc");
  return params.toString();
}

function pageHref(filters: ReportFilters, page: number): string {
  return `/dashboard/hr/reports?${exportSearch(filters)}&page=${page}`;
}

function sortHref(filters: ReportFilters, sort: string): string {
  const direction = filters.sort === sort && filters.direction === "asc" ? "desc" : "asc";
  return `/dashboard/hr/reports?${exportSearch({ ...filters, sort, direction })}`;
}

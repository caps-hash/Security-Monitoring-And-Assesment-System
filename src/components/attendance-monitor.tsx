import Link from "next/link";
import { AttendanceHistory } from "@/components/attendance-history";
import { AttendanceSummary } from "@/components/attendance-summary";
import type { AttendanceReportView } from "@/lib/attendance/report-data";
import type { MonitorData } from "@/lib/attendance/types";

export function AttendanceMonitor({
  data,
  basePath,
  description,
  report,
}: {
  data: MonitorData;
  basePath: string;
  description: string;
  report: AttendanceReportView;
}) {
  return (
    <section aria-labelledby="attendance-monitor-heading">
      <h2 className="text-lg font-semibold text-slate-900" id="attendance-monitor-heading">
        Attendance monitoring
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      <AttendanceSummary basePath={basePath} view={report} />
      <form className="mt-4 grid gap-3 lg:grid-cols-5" method="get">
        <input name="period" type="hidden" value="custom" />
        <label className="text-sm font-medium text-slate-700">
          From
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={data.filters.from} name="from" type="date" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          To
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={data.filters.to} name="to" type="date" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Employee
          <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={data.filters.employeeId} name="employee">
            <option value="">All in scope</option>
            {data.employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Location
          <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={data.filters.locationId} name="location">
            <option value="">All locations</option>
            {data.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Status
          <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={data.filters.status} name="status">
            <option value="">All</option>
            <option value="open">Missing Time Out</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <button className="w-fit rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white" type="submit">
          Apply filters
        </button>
      </form>
      {data.schemaReady ? null : (
        <p className="mt-4 text-sm text-amber-800" role="status">
          {data.message}
        </p>
      )}
      <AttendanceHistory records={data.records} showEmployee />
      {data.pageCount > 1 ? (
        <p className="mt-4 flex gap-4 text-sm font-semibold">
          {data.filters.page > 1 ? (
            <Link className="text-blue-900" href={pageHref(basePath, data, data.filters.page - 1)}>
              Previous
            </Link>
          ) : null}
          <span className="font-medium text-slate-600">
            Page {data.filters.page} of {data.pageCount}
          </span>
          {data.filters.page < data.pageCount ? (
            <Link className="text-blue-900" href={pageHref(basePath, data, data.filters.page + 1)}>
              Next
            </Link>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

function pageHref(basePath: string, data: MonitorData, page: number): string {
  const search = new URLSearchParams({
    from: data.filters.from,
    to: data.filters.to,
    page: String(page),
  });
  if (data.filters.status) {
    search.set("status", data.filters.status);
  }
  if (data.filters.employeeId) {
    search.set("employee", data.filters.employeeId);
  }
  if (data.filters.locationId) {
    search.set("location", data.filters.locationId);
  }
  return `${basePath}?${search.toString()}`;
}


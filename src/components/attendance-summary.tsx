import Link from "next/link";
import type { AttendanceReportView } from "@/lib/attendance/report-data";
import type { SummaryCategory } from "@/lib/attendance/report";

const cards: { category: SummaryCategory; label: string }[] = [
  { category: "expected", label: "Scheduled" },
  { category: "time_in", label: "Time In" },
  { category: "time_out", label: "Time Out" },
  { category: "late", label: "Late" },
  { category: "missing_time_in", label: "Missing Time In" },
  { category: "missing_time_out", label: "Missing Time Out" },
  { category: "no_record", label: "No record" },
  { category: "potential_absence", label: "Potential absence" },
  { category: "in_progress", label: "Shift not finished" },
  { category: "review", label: "Data review" },
  { category: "repeated", label: "Repeated issues" },
  { category: "unconfigured", label: "Workdays not set" },
];

export function AttendanceSummary({
  view,
  basePath,
  personal = false,
}: {
  view: AttendanceReportView;
  basePath: string;
  personal?: boolean;
}) {
  if (!view.ready || !view.report) {
    return (
      <p className="mt-4 text-sm text-amber-800" role="alert">
        {view.message ?? "Attendance summary could not be loaded. Counts are hidden because the data is unavailable."}
      </p>
    );
  }
  const report = view.report;
  const selected = report.lists[report.category];
  const rate =
    report.completionRate == null
      ? "Not calculated"
      : `${Math.round(report.completionRate * 1000) / 10}%`;

  return (
    <section aria-labelledby="attendance-summary-heading" className="mt-6">
      <h2 className="text-lg font-semibold text-slate-900" id="attendance-summary-heading">
        {personal ? "My attendance summary" : "Attendance summary"}
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
        {periodLabel(report.period)} {report.from} to {report.to}, Philippine dates. Official
        absences are {report.officialAbsence}. Completion rate: {rate}. {report.completionDenominator}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
        <Link className="text-blue-900" href={href(basePath, view, { period: "daily" })}>Daily</Link>
        <Link className="text-blue-900" href={href(basePath, view, { period: "weekly" })}>Weekly</Link>
        <Link className="text-blue-900" href={href(basePath, view, { period: "monthly" })}>Monthly</Link>
        <Link className="text-blue-900" href={href(basePath, view, { anchor: shiftAnchor(view.filters.anchor, report.period, -1) })}>Previous</Link>
        <Link className="text-blue-900" href={href(basePath, view, { anchor: shiftAnchor(view.filters.anchor, report.period, 1) })}>Next</Link>
      </div>
      <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <input name="period" type="hidden" value="custom" />
        <label className="text-sm font-medium text-slate-700">
          From
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={report.from} name="from" type="date" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          To
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={report.to} name="to" type="date" />
        </label>
        {personal ? null : (
          <label className="text-sm font-medium text-slate-700">
            Employee
            <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={view.filters.employeeId} name="employee">
              <option value="">All in scope</option>
              {view.employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          </label>
        )}
        {personal || !view.supervisors.length ? null : (
          <label className="text-sm font-medium text-slate-700">
            Supervisor
            <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={view.filters.supervisorId} name="supervisor">
              <option value="">All supervisors</option>
              {view.supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>
              ))}
            </select>
          </label>
        )}
        <button className="self-end rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white" type="submit">
          Apply range
        </button>
      </form>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            className={`rounded-lg border p-3 ${report.category === card.category ? "border-blue-700 bg-blue-50" : "border-slate-200"}`}
            href={href(basePath, view, { category: card.category, period: report.period })}
            key={card.category}
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</dt>
            <dd className="mt-1 text-xl font-bold text-slate-950">{report.counts[card.category]}</dd>
          </Link>
        ))}
      </dl>
      <p className="mt-3 text-sm text-slate-600">
        Dates with no recorded attendance among scheduled personnel: {report.daysWithoutScheduledAttendance.length
          ? report.daysWithoutScheduledAttendance.join(", ")
          : "None"}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <caption className="mb-2 text-left font-semibold text-slate-900">
            {cards.find((card) => card.category === report.category)?.label} list ({selected.length})
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Employee</th>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Supervisor</th>
              <th className="py-2 pr-3">Post / shift</th>
              <th className="py-2 pr-3">Time In</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {selected.length ? selected.map((row) => (
              <tr className="border-b border-slate-100" key={row.key}>
                <td className="py-2 pr-3">
                  {row.recordId ? (
                    <a className="font-semibold text-blue-900" href={`#${row.recordId}`}>{row.employeeName}</a>
                  ) : row.employeeName}
                  <span className="block text-xs text-slate-500">{row.employeeNumber ?? "No employee number"}</span>
                </td>
                <td className="py-2 pr-3">{row.attendanceDate}</td>
                <td className="py-2 pr-3">{row.supervisorName ?? "Not assigned"}</td>
                <td className="py-2 pr-3">
                  {row.postName ?? "Not assigned"}
                  <span className="block text-xs text-slate-500">
                    {row.shiftName ?? "No shift"}{row.shiftStart ? ` · starts ${row.shiftStart.slice(0, 5)}` : ""}
                    {row.minutesLate != null ? ` · ${row.minutesLate} min late` : ""}
                  </span>
                </td>
                <td className="py-2 pr-3">{row.timeInLabel}</td>
                <td className="py-2 pr-3">
                  {row.statusLabel}
                  <span className="block text-xs text-slate-500">{row.detail}</span>
                </td>
              </tr>
            )) : (
              <tr>
                <td className="py-3 text-slate-600" colSpan={6}>No personnel match this category for the selected period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {report.period === "daily" ? null : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <caption className="mb-2 text-left font-semibold text-slate-900">Daily breakdown</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Scheduled</th>
                <th className="py-2 pr-3">Time In</th>
                <th className="py-2 pr-3">Time Out</th>
                <th className="py-2 pr-3">Late</th>
                <th className="py-2 pr-3">Missing In</th>
                <th className="py-2 pr-3">Missing Out</th>
              </tr>
            </thead>
            <tbody>
              {report.daily.map((day) => (
                <tr className="border-b border-slate-100" key={day.date}>
                  <td className="py-2 pr-3">{day.date}</td>
                  <td className="py-2 pr-3">{day.expected}</td>
                  <td className="py-2 pr-3">{day.timeIn}</td>
                  <td className="py-2 pr-3">{day.timeOut}</td>
                  <td className="py-2 pr-3">{day.late}</td>
                  <td className="py-2 pr-3">{day.missingTimeIn}</td>
                  <td className="py-2 pr-3">{day.missingTimeOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <caption className="mb-2 text-left font-semibold text-slate-900">Personnel totals</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="py-2 pr-3">Employee</th>
              <th className="py-2 pr-3">Scheduled</th>
              <th className="py-2 pr-3">Recorded</th>
              <th className="py-2 pr-3">Late</th>
              <th className="py-2 pr-3">Missing In</th>
              <th className="py-2 pr-3">Missing Out</th>
            </tr>
          </thead>
          <tbody>
            {report.personnel.map((person) => (
              <tr className="border-b border-slate-100" key={person.employeeId}>
                <td className="py-2 pr-3">{person.employeeName}</td>
                <td className="py-2 pr-3">{person.expected}</td>
                <td className="py-2 pr-3">{person.recorded}</td>
                <td className="py-2 pr-3">{person.late}</td>
                <td className="py-2 pr-3">{person.missingTimeIn}</td>
                <td className="py-2 pr-3">{person.missingTimeOut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
        {report.limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </section>
  );
}

function href(
  basePath: string,
  view: AttendanceReportView,
  change: { period?: string; anchor?: string; category?: string },
): string {
  const search = new URLSearchParams({
    period: change.period ?? view.filters.period,
    anchor: change.anchor ?? view.filters.anchor,
    category: change.category ?? view.filters.category,
  });
  if (view.filters.employeeId) {
    search.set("employee", view.filters.employeeId);
  }
  if (view.filters.locationId) {
    search.set("location", view.filters.locationId);
  }
  if (view.filters.supervisorId) {
    search.set("supervisor", view.filters.supervisorId);
  }
  return `${basePath}?${search.toString()}`;
}

function shiftAnchor(anchor: string, period: string, direction: number): string {
  const date = new Date(`${anchor}T12:00:00+08:00`);
  if (period === "monthly") {
    date.setUTCMonth(date.getUTCMonth() + direction);
  } else if (period === "weekly") {
    date.setUTCDate(date.getUTCDate() + direction * 7);
  } else {
    date.setUTCDate(date.getUTCDate() + direction);
  }
  return date.toISOString().slice(0, 10);
}

function periodLabel(period: string): string {
  if (period === "weekly") {
    return "Weekly summary, Monday–Sunday.";
  }
  if (period === "monthly") {
    return "Monthly summary.";
  }
  if (period === "custom") {
    return "Custom range summary.";
  }
  return "Daily summary.";
}

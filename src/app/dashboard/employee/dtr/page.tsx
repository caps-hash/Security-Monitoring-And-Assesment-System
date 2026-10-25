import type { Metadata } from "next";
import Link from "next/link";
import { AttendanceCapture } from "@/components/attendance-capture";
import { AttendanceHistory } from "@/components/attendance-history";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireRole } from "@/lib/auth/profile";
import { manilaRange } from "@/lib/attendance/policy";
import { AttendanceSummary } from "@/components/attendance-summary";
import { loadAttendanceReport } from "@/lib/attendance/report-data";
import {
  getDutyContext,
  getOwnAttendanceState,
  listOwnAttendance,
  readAttendanceFilters,
} from "@/lib/attendance/queries";

export const metadata: Metadata = {
  title: "My DTR",
};

export default async function EmployeeDtrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole("employee");
  const params = await searchParams;
  const report = await loadAttendanceReport({
    role: "employee",
    viewerId: profile.id,
    params,
  });
  const filters = readAttendanceFilters(params);
  if (report.report) {
    filters.from = report.report.from;
    filters.to = report.report.to;
  }
  const [duty, state, history] = await Promise.all([
    getDutyContext(profile.id),
    getOwnAttendanceState(profile.id),
    listOwnAttendance(profile.id, filters),
  ]);
  const ranges = {
    today: manilaRange("today"),
    week: manilaRange("week"),
    month: manilaRange("month"),
  };

  return (
    <DashboardPlaceholder profile={profile} role="employee">
      <section aria-labelledby="dtr-heading">
        <h2 className="text-lg font-semibold text-slate-900" id="dtr-heading">
          Daily time record
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Times below are Philippine time (PHT). A missing Time Out stays blank.
          It is not filled in automatically.
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Duty post" value={duty?.postName ?? "Not assigned"} />
          <Field
            label="Duty location"
            value={
              duty
                ? [duty.locationName, duty.locationAddress].filter(Boolean).join(" · ")
                : "Not assigned"
            }
          />
          <Field
            label="Shift"
            value={
              duty
                ? `${duty.shiftName} (${duty.shiftStart.slice(0, 5)}–${duty.shiftEnd.slice(0, 5)})`
                : "Not assigned"
            }
          />
          <Field label="Attendance date" value={ranges.today.from} />
          <Field label="Time In" value={state.today?.timeInLabel ?? "Not recorded"} />
          <Field label="Time Out" value={state.today?.timeOutLabel ?? "Not recorded"} />
          <Field
            label="Verification"
            value={state.today?.timeInVerification ?? "Not recorded"}
          />
          <Field
            label="Today"
            value={
              state.today
                ? state.today.status === "open"
                  ? "On duty, missing Time Out"
                  : "Completed"
                : "No record"
            }
          />
          <Field
            label="Geofence"
            value={duty?.radiusMeters ? `${duty.radiusMeters} m configured` : "Not configured"}
          />
        </dl>
      </section>

      <AttendanceSummary basePath="/dashboard/employee/dtr" personal view={report} />

      <AttendanceCapture
        completedToday={state.completedToday}
        duty={duty}
        employeeNumber={profile.employee_number}
        openSession={state.open}
        schemaReady={state.schemaReady && history.schemaReady}
      />

      <section className="mt-10 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Attendance history</h2>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link className="text-blue-900 hover:text-blue-700" href={rangeHref(ranges.today)}>
              Today
            </Link>
            <Link className="text-blue-900 hover:text-blue-700" href={rangeHref(ranges.week)}>
              Last 7 days
            </Link>
            <Link className="text-blue-900 hover:text-blue-700" href={rangeHref(ranges.month)}>
              This month
            </Link>
          </div>
        </div>
        <form className="mt-4 grid gap-3 sm:grid-cols-4" method="get">
          <input name="period" type="hidden" value="custom" />
          <label className="text-sm font-medium text-slate-700">
            From
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2"
              defaultValue={filters.from}
              name="from"
              type="date"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            To
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2"
              defaultValue={filters.to}
              name="to"
              type="date"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2"
              defaultValue={filters.status}
              name="status"
            >
              <option value="">All</option>
              <option value="open">Missing Time Out</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <button
            className="self-end rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
            type="submit"
          >
            Apply
          </button>
        </form>
        {history.schemaReady ? null : (
          <p className="mt-4 text-sm text-amber-800" role="status">
            Attendance history is unavailable until supabase/schema.sql is applied.
          </p>
        )}
        <AttendanceHistory records={history.records} />
        <Pager page={filters.page} pageCount={history.pageCount} params={filters} />
      </section>
    </DashboardPlaceholder>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function rangeHref(range: { from: string; to: string }): string {
  return `/dashboard/employee/dtr?period=custom&from=${range.from}&to=${range.to}`;
}

function Pager({
  page,
  pageCount,
  params,
}: {
  page: number;
  pageCount: number;
  params: { from: string; to: string; status: string };
}) {
  if (pageCount <= 1) {
    return null;
  }
  const query = (nextPage: number) => {
    const search = new URLSearchParams({
      from: params.from,
      to: params.to,
      page: String(nextPage),
    });
    if (params.status) {
      search.set("status", params.status);
    }
    return `/dashboard/employee/dtr?${search.toString()}`;
  };
  return (
    <p className="mt-4 flex gap-4 text-sm font-semibold">
      {page > 1 ? (
        <Link className="text-blue-900" href={query(page - 1)}>
          Previous
        </Link>
      ) : null}
      <span className="font-medium text-slate-600">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link className="text-blue-900" href={query(page + 1)}>
          Next
        </Link>
      ) : null}
    </p>
  );
}

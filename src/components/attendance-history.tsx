import type { AttendanceView } from "@/lib/attendance/types";

export function AttendanceHistory({
  records,
  showEmployee = false,
}: {
  records: AttendanceView[];
  showEmployee?: boolean;
}) {
  if (!records.length) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        No attendance records match this view. Missing Time Out is shown only when a Time In exists and has not been closed.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {records.map((record) => (
        <article className="rounded-lg border border-slate-200 p-4" id={record.id} key={record.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">
                {record.attendanceDate}
                {record.overnight ? " · overnight" : ""}
              </h3>
              {showEmployee ? (
                <p className="mt-1 text-sm text-slate-700">
                  {record.employeeName}
                  {record.employeeNumber ? ` · ${record.employeeNumber}` : ""}
                </p>
              ) : null}
            </div>
            <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {record.status === "open" ? "Time Out not recorded" : "Completed"}
            </span>
          </div>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Item label="Post" value={record.postName} />
            <Item label="Duty location" value={record.locationName} />
            <Item label="Shift" value={record.shiftLabel} />
            <Item label="Shift comparison" value={record.shiftNote} />
            <Item label="Time In" value={record.timeInLabel} />
            <Item label="Time Out" value={record.timeOutLabel} />
            <Item label="Duration" value={record.durationLabel} />
            <Item label="Time In check" value={record.timeInVerification} />
            <Item label="Time Out check" value={record.timeOutVerification} />
            <Item label="Time In GPS" value={record.timeInCoordinates} />
            <Item label="Time Out GPS" value={record.timeOutCoordinates} />
            <Item label="Time In place" value={record.timeInPlace ?? "Not resolved"} />
            <Item label="Time Out place" value={record.timeOutPlace ?? "Not resolved"} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <EvidenceLink href={record.timeInPhotoUrl} label="Time In evidence" />
            <EvidenceLink href={record.timeOutPhotoUrl} label="Time Out evidence" />
          </div>
        </article>
      ))}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-800">{value}</dd>
    </div>
  );
}

function EvidenceLink({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return <span className="text-slate-500">{label} unavailable</span>;
  }
  return (
    <a className="font-semibold text-blue-900 hover:text-blue-700" href={href} rel="noreferrer" target="_blank">
      {label}
    </a>
  );
}

import type { EmployeeAssignmentDetails as Assignment } from "@/lib/personnel/employee-assignment";

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

function AssignmentField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "Not assigned"}</dd>
    </div>
  );
}

export function EmployeeAssignmentDetails({
  assignment,
}: {
  assignment: Assignment | null;
}) {
  if (!assignment) {
    return (
      <section aria-labelledby="assignment-heading">
        <h2
          className="text-lg font-semibold text-slate-900"
          id="assignment-heading"
        >
          Current assignment
        </h2>
        <p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          No current assignment is available. Contact HR for assignment
          information.
        </p>
      </section>
    );
  }

  const shiftTime =
    assignment.shiftStart && assignment.shiftEnd
      ? ` (${assignment.shiftStart.slice(0, 5)}–${assignment.shiftEnd.slice(0, 5)})`
      : "";

  return (
    <section aria-labelledby="assignment-heading">
      <h2 className="text-lg font-semibold text-slate-900" id="assignment-heading">
        Current assignment
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <AssignmentField label="Security post" value={assignment.postName} />
        <AssignmentField
          label="Duty location"
          value={
            assignment.locationName
              ? `${assignment.locationName}${assignment.locationAddress ? ` — ${assignment.locationAddress}` : ""}`
              : null
          }
        />
        <AssignmentField
          label="Duty shift"
          value={
            assignment.shiftName
              ? `${assignment.shiftName}${shiftTime}`
              : null
          }
        />
        <AssignmentField
          label="Start date at post"
          value={formatDate(assignment.startDate)}
        />
      </dl>
    </section>
  );
}

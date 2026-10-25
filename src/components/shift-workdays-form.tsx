"use client";

import { useActionState } from "react";
import { saveShiftWorkdays, type WorkdayState } from "@/app/dashboard/hr/duty/workdays-actions";

const initialState: WorkdayState = { error: null, success: null };
const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ShiftWorkdaysForm({
  shifts,
}: {
  shifts: { id: string; name: string; startTime: string; endTime: string; weekdays: number[] | null }[];
}) {
  return (
    <section className="mt-10 border-t border-slate-200 pt-6" aria-labelledby="workdays-heading">
      <h2 className="text-lg font-semibold text-slate-900" id="workdays-heading">
        Shift workdays
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
        Choose the weekdays a shift is expected to work. Leave this unset until the agency confirms
        the schedule. Unset shifts are not counted as absences.
      </p>
      <div className="mt-4 space-y-4">
        {shifts.length ? shifts.map((shift) => <ShiftForm key={shift.id} shift={shift} />) : (
          <p className="text-sm text-slate-600">No duty shifts exist yet.</p>
        )}
      </div>
    </section>
  );
}

function ShiftForm({
  shift,
}: {
  shift: { id: string; name: string; startTime: string; endTime: string; weekdays: number[] | null };
}) {
  const [state, action, pending] = useActionState(saveShiftWorkdays, initialState);
  return (
    <form action={action} className="rounded-lg border border-slate-200 p-4">
      <input name="shiftId" type="hidden" value={shift.id} />
      <p className="text-sm font-semibold text-slate-900">
        {shift.name} ({shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)})
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {shift.weekdays?.length ? "Configured" : "Not configured"}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {labels.map((label, index) => (
          <label className="text-sm text-slate-700" key={label}>
            <input
              className="mr-1"
              defaultChecked={shift.weekdays?.includes(index) ?? false}
              name="weekday"
              type="checkbox"
              value={index}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={pending} type="submit">
          Save workdays
        </button>
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800" disabled={pending} name="clear" type="submit" value="1">
          Clear schedule
        </button>
      </div>
      {state.error ? <p className="mt-2 text-sm text-red-700" role="alert">{state.error}</p> : null}
      {state.success ? <p className="mt-2 text-sm text-green-800" role="status">{state.success}</p> : null}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { saveRankingWeights, type RankingActionState } from "@/app/dashboard/hr/reports/actions";

const initialState: RankingActionState = { error: null, success: null };

export function RankingWeightsForm({
  assessmentWeight,
  attendanceWeight,
  sourceNote,
  approved,
}: {
  assessmentWeight: string;
  attendanceWeight: string;
  sourceNote: string;
  approved: boolean;
}) {
  const [state, action, pending] = useActionState(saveRankingWeights, initialState);
  return (
    <form action={action} className="print-hidden mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
      <h3 className="text-sm font-semibold text-slate-900 md:col-span-2">Ranking weights</h3>
      <p className="text-sm text-slate-600 md:col-span-2">
        No formula is assumed. Combined ranking is used only after HR approves weights totaling 100%.
      </p>
      <label className="text-sm font-medium text-slate-700">
        Assessment weight
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={assessmentWeight} name="assessmentWeight" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Attendance weight
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={attendanceWeight} name="attendanceWeight" />
      </label>
      <label className="text-sm font-medium text-slate-700 md:col-span-2">
        Approval note
        <textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={sourceNote} maxLength={500} name="sourceNote" />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input defaultChecked={approved} name="approve" type="checkbox" />
        Approve this formula for combined ranking
      </label>
      <button className="w-fit rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Saving" : "Save weights"}
      </button>
      {state.error ? <p className="text-sm text-red-700 md:col-span-2">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700 md:col-span-2">{state.success}</p> : null}
    </form>
  );
}

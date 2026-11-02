"use client";

import { useActionState } from "react";
import {
  recalculateRatings,
  saveRatingConfiguration,
  type EvaluationActionState,
} from "@/app/dashboard/evaluation-actions";
import { PDF_OVERALL_RATING_REFERENCE } from "@/lib/assessment/criteria";
import type { RatingConfigurationView } from "@/lib/assessment/evaluation-queries";

const initialState: EvaluationActionState = { error: null, success: null };

export function RatingConfigurationForm({ configuration }: { configuration: RatingConfigurationView }) {
  const [state, action, pending] = useActionState(saveRatingConfiguration, initialState);
  const [recalcState, recalc, recalculating] = useActionState(recalculateRatings, initialState);
  if (!configuration.ready) {
    return <p className="mt-4 text-sm text-amber-800">Rating configuration is unavailable until the Phase 6 migration is applied.</p>;
  }
  return (
    <section className="mt-8 rounded-lg border border-slate-200 p-4">
      <h2 className="text-lg font-semibold text-slate-950">Official rating configuration</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Supervisor selections are qualitative and are not converted into points. The transcribed form lists overall bands of{" "}
        {PDF_OVERALL_RATING_REFERENCE.map((band) => `${band.range} ${band.label}`).join(", ")}. Phase 6 also names Outstanding, Very Satisfactory, Satisfactory, Needs Improvement, and Unsatisfactory, but those ranges are not approved. No rating is calculated until HR enters bands and explicitly approves them.
      </p>
      <p className="mt-2 text-sm text-slate-700">
        Status: {configuration.approved ? "Approved" : "Not approved"}
        {configuration.sourceNote ? ` · ${configuration.sourceNote}` : ""}
      </p>
      <form action={action} className="mt-4 space-y-3">
        {[1, 2, 3, 4, 5].map((index) => {
          const band = configuration.bands[index - 1];
          return (
            <div className="grid gap-2 sm:grid-cols-3" key={index}>
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue={band?.label ?? ""} name={`label${index}`} placeholder="Rating label" />
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue={band?.minScore ?? ""} name={`min${index}`} placeholder="Minimum score" step="0.01" type="number" />
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue={band?.maxScore ?? ""} name={`max${index}`} placeholder="Maximum score" step="0.01" type="number" />
            </div>
          );
        })}
        <label className="block text-sm font-medium text-slate-700">
          Agency approval note
          <textarea className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={configuration.sourceNote ?? ""} minLength={8} name="sourceNote" required rows={2} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input name="approve" type="checkbox" value="yes" />
          Approve this configuration for official rating calculation
        </label>
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={pending} type="submit">
          Save rating configuration
        </button>
        {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-green-800">{state.success}</p> : null}
      </form>
      <form action={recalc} className="mt-4">
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" disabled={recalculating} type="submit">
          Recalculate released ratings
        </button>
        {recalcState.error ? <p className="mt-2 text-sm text-red-700">{recalcState.error}</p> : null}
        {recalcState.success ? <p className="mt-2 text-sm text-green-800">{recalcState.success}</p> : null}
      </form>
    </section>
  );
}

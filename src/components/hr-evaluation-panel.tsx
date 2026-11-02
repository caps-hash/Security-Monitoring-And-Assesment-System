"use client";

import { useActionState } from "react";
import {
  issueFinalDecision,
  noteEvaluation,
  releaseEvaluation,
  releaseFinalDecision,
  saveOfficialResult,
  type EvaluationActionState,
} from "@/app/dashboard/evaluation-actions";
import { HR_RECOMMENDATIONS, recommendationLabel } from "@/lib/assessment/criteria";
import type { EvaluationDetail } from "@/lib/assessment/evaluation-queries";
import { EvaluationForm } from "@/components/evaluation-form";

const initialState: EvaluationActionState = { error: null, success: null };

export function HrEvaluationPanel({ detail }: { detail: EvaluationDetail }) {
  if (!detail.assessment) {
    return <p className="text-sm text-amber-800">{detail.message}</p>;
  }
  return (
    <div className="space-y-6">
      <EvaluationForm actor="hr" detail={detail} />
      <OfficialResultForm detail={detail} />
      <ReleaseForm detail={detail} />
      <NoteForm assessmentId={detail.assessment.id} />
      {detail.assessment.evaluationNumber === 3 ? <FinalDecisionForm detail={detail} /> : null}
    </div>
  );
}

function OfficialResultForm({ detail }: { detail: EvaluationDetail }) {
  const [state, action, pending] = useActionState(saveOfficialResult, initialState);
  const assessment = detail.assessment;
  if (!assessment || assessment.workflowStatus !== "under_review") {
    return (
      <p className="text-sm text-slate-600">
        {detail.result
          ? `Saved official score ${detail.result.officialScore ?? "not recorded"}. Recommendation: ${recommendationLabel(detail.result.recommendation)}. Supervisor ratings are not converted into this score.`
          : "Accept the submission before entering the official score. Supervisor ratings are not converted into a score."}
      </p>
    );
  }
  return (
    <form action={action} className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Official HR result</h3>
      <input name="assessmentId" type="hidden" value={assessment.id} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Official score (0–100)
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={detail.result?.officialScore ?? ""} max={100} min={0} name="officialScore" required step="0.01" type="number" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          HRO recommendation
          <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={detail.result?.recommendation ?? ""} name="recommendation" required>
            <option value="">Select</option>
            {HR_RECOMMENDATIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        HR feedback
        <textarea className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={detail.result?.feedback ?? ""} maxLength={2000} name="feedback" required rows={3} />
      </label>
      <button className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={pending} type="submit">
        Save official result
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function ReleaseForm({ detail }: { detail: EvaluationDetail }) {
  const [state, action, pending] = useActionState(releaseEvaluation, initialState);
  if (detail.assessment?.workflowStatus !== "under_review") {
    return null;
  }
  return (
    <form action={action} className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Complete and release</h3>
      <input name="assessmentId" type="hidden" value={detail.assessment.id} />
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
        <input name="confirmRelease" type="checkbox" value="yes" />
        I confirm this result is ready to release.
      </label>
      <button className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={pending} type="submit">
        Release result
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function NoteForm({ assessmentId }: { assessmentId: string }) {
  const [state, action, pending] = useActionState(noteEvaluation, initialState);
  return (
    <form action={action}>
      <input name="assessmentId" type="hidden" value={assessmentId} />
      <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" disabled={pending} type="submit">
        Record that I noted this as Human Resource Officer
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function FinalDecisionForm({ detail }: { detail: EvaluationDetail }) {
  const [issueState, issue, issuing] = useActionState(issueFinalDecision, initialState);
  const [releaseState, release, releasing] = useActionState(releaseFinalDecision, initialState);
  const employeeId = detail.assessment?.employeeId;
  if (!employeeId) {
    return null;
  }
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">Final decision</h3>
      <p className="mt-1 text-sm text-slate-600">
        Available after Evaluation 3 is completed. The system does not decide Passed or Not Passed.
        Current: {detail.finalDecision ? `${detail.finalDecision.decision} ${detail.finalDecision.releasedAt ? "(released)" : "(not released)"}` : "Not issued"}
      </p>
      <form action={issue} className="mt-3 grid gap-3">
        <input name="employeeId" type="hidden" value={employeeId} />
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="decision" required>
          <option value="">Select</option>
          <option value="passed">PASSED</option>
          <option value="not_passed">NOT PASSED</option>
        </select>
        <textarea className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="remark" placeholder="Official decision remark" rows={2} />
        <label className="flex items-center gap-2 text-sm">
          <input name="confirmDecision" type="checkbox" value="yes" />
          I confirm this final decision.
        </label>
        <button className="w-fit rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={issuing} type="submit">
          Save decision
        </button>
        <ActionMessage state={issueState} />
      </form>
      <form action={release} className="mt-4">
        <input name="employeeId" type="hidden" value={employeeId} />
        <label className="flex items-center gap-2 text-sm">
          <input name="confirmReleaseDecision" type="checkbox" value="yes" />
          Release the saved decision.
        </label>
        <button className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" disabled={releasing} type="submit">
          Release decision
        </button>
        <ActionMessage state={releaseState} />
      </form>
      {detail.finalDecision?.remark ? <p className="mt-2 text-sm text-slate-700">Remark: {detail.finalDecision.remark}</p> : null}
    </section>
  );
}

function ActionMessage({ state }: { state: EvaluationActionState }) {
  return (
    <>
      {state.error ? <p className="mt-2 text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="mt-2 text-sm text-green-800">{state.success}</p> : null}
    </>
  );
}

"use client";

import { useActionState } from "react";
import { acknowledgeEvaluation, type EvaluationActionState } from "@/app/dashboard/evaluation-actions";

const initialState: EvaluationActionState = { error: null, success: null };

export function EmployeeEvaluationResults({
  items,
  finalDecision,
  message,
}: {
  items: {
    assessmentId: string;
    evaluationNumber: number;
    evaluationDate: string | null;
    officialScore: number | null;
    calculatedRating: string | null;
    feedback: string | null;
    releasedAt: string;
    acknowledged: boolean;
  }[];
  finalDecision: {
    decision: "passed" | "not_passed";
    remark: string | null;
    releasedAt: string | null;
  } | null;
  message: string | null;
}) {
  if (message) {
    return <p className="mt-6 text-sm text-amber-800">{message}</p>;
  }
  return (
    <section className="mt-8 border-t border-slate-200 pt-6" aria-labelledby="released-results-heading">
      <h2 className="text-lg font-semibold text-slate-950" id="released-results-heading">
        Released evaluation results
      </h2>
      {items.length ? (
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <article className="rounded-lg border border-slate-200 p-4" key={item.assessmentId}>
              <h3 className="font-semibold text-slate-950">Evaluation {item.evaluationNumber}</h3>
              <p className="mt-1 text-sm text-slate-600">Evaluation date: {item.evaluationDate ?? "Not recorded"} · Released {item.releasedAt}</p>
              <p className="mt-2 text-sm text-slate-800">Score: {item.officialScore ?? "Not recorded"}</p>
              <p className="text-sm text-slate-800">Rating: {item.calculatedRating ?? "Not calculated until HR approves a rating configuration."}</p>
              <p className="text-sm text-slate-800">Feedback: {item.feedback ?? "Not recorded"}</p>
              {item.acknowledged ? (
                <p className="mt-2 text-sm text-green-800">Acknowledged</p>
              ) : (
                <AcknowledgeForm assessmentId={item.assessmentId} />
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">No released scores, ratings, or feedback are available.</p>
      )}
      <div className="mt-4 rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">Final decision</h3>
        {finalDecision?.releasedAt ? (
          <p className="mt-2 text-sm text-slate-800">
            {finalDecision.decision === "passed" ? "PASSED" : "NOT PASSED"}
            {finalDecision.remark ? ` · ${finalDecision.remark}` : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No final decision has been released.</p>
        )}
      </div>
    </section>
  );
}

function AcknowledgeForm({ assessmentId }: { assessmentId: string }) {
  const [state, action, pending] = useActionState(acknowledgeEvaluation, initialState);
  return (
    <form action={action} className="mt-3">
      <input name="assessmentId" type="hidden" value={assessmentId} />
      <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" disabled={pending} type="submit">
        Acknowledge this released result
      </button>
      {state.error ? <p className="mt-2 text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="mt-2 text-sm text-green-800">{state.success}</p> : null}
    </form>
  );
}

"use client";

import { useActionState, useMemo, useState } from "react";
import {
  saveEvaluationDraft,
  submitEvaluationForm,
  uploadEvaluationFile,
  type EvaluationActionState,
} from "@/app/dashboard/evaluation-actions";
import {
  EVALUATION_RATINGS,
  criteriaSections,
  ratingLabel,
  recommendationLabel,
} from "@/lib/assessment/criteria";
import type { EvaluationDetail } from "@/lib/assessment/evaluation-queries";
import { EvaluationFileButton } from "@/components/evaluation-file-button";

const initialState: EvaluationActionState = { error: null, success: null };

export function EvaluationForm({
  detail,
  actor = "supervisor",
}: {
  detail: EvaluationDetail;
  actor?: "supervisor" | "hr";
}) {
  const assessment = detail.assessment;
  const [reviewing, setReviewing] = useState(false);
  const [reviewRatings, setReviewRatings] = useState<Record<string, string>>({});
  const [draftState, saveDraft, saving] = useActionState(saveEvaluationDraft, initialState);
  const [submitState, submit, submitting] = useActionState(submitEvaluationForm, initialState);
  const [uploadState, upload, uploading] = useActionState(uploadEvaluationFile, initialState);
  const editable =
    actor === "supervisor" &&
    (assessment?.workflowStatus === "scheduled" || assessment?.workflowStatus === "returned_for_correction");
  const ratedCount = useMemo(
    () => Object.values(detail.responses).filter((response) => response.rating).length,
    [detail.responses],
  );

  if (!assessment) {
    return <p className="text-sm text-amber-800">{detail.message}</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
          Global Ground Force · Security Performance Evaluation Form
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">
          Evaluation {assessment.evaluationNumber}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {assessment.employeeName} · {assessment.employeeNumber ?? "No employee number"} · Status {labelStatus(assessment.workflowStatus)}
        </p>
      </header>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Field label="Employee name" value={assessment.employeeName} />
        <Field label="Position" value={assessment.positionTitle ?? "No assigned post is stored"} />
        <Field label="Department / Section" value={assessment.departmentSection ?? "No duty location is stored"} />
        <Field label="Assigned supervisor" value={assessment.supervisorName} />
        <Field label="Due date" value={assessment.dueDate} />
        <Field label="Form status" value={assessment.formStatus ?? "Not started"} />
      </dl>
      <p className="text-sm text-slate-600">
        Position and department are taken from the assigned post and duty location. SAMS does not store a separate position title.
      </p>
      {detail.corrections.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <h3 className="font-semibold">Correction remarks</h3>
          <ul className="mt-2 space-y-1">
            {detail.corrections.map((item) => (
              <li key={item.createdAt}>{item.createdAt}: {item.remarks}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-sm font-medium text-slate-700">
        Completion: {ratedCount} of 11 criteria rated
      </p>
      <form action={reviewing ? submit : saveDraft} className="space-y-6">
        <input name="assessmentId" type="hidden" value={assessment.id} />
        <label className="block text-sm font-medium text-slate-700">
          Date of evaluation
          <input
            className="mt-1.5 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2"
            defaultValue={assessment.evaluationDate ?? ""}
            disabled={!editable}
            name="evaluationDate"
            required
            type="date"
          />
        </label>
        {criteriaSections().map((section) => (
          <section className="rounded-lg border border-slate-200 p-4" key={section.title}>
            <h3 className="font-semibold text-slate-950">{section.title} — {section.weight}</h3>
            <div className="mt-4 space-y-5">
              {section.criteria.map((criterion) => (
                <fieldset className="border-t border-slate-100 pt-4" key={criterion.code}>
                  <legend className="text-sm font-semibold text-slate-900">
                    {criterion.letter}. {criterion.title} ({criterion.weight})
                  </legend>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{criterion.description}</p>
                  <div className="mt-3 grid gap-2">
                    {EVALUATION_RATINGS.map((rating) => (
                      <label className="flex items-center gap-2 text-sm text-slate-800" key={rating.value}>
                        <input
                          defaultChecked={detail.responses[criterion.code]?.rating === rating.value}
                          disabled={!editable}
                          name={`rating-${criterion.code}`}
                          required={editable}
                          type="radio"
                          value={rating.value}
                        />
                        {rating.label}
                      </label>
                    ))}
                  </div>
                  <label className="mt-3 block text-sm font-medium text-slate-700">
                    Comments / Remarks
                    <textarea
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2"
                      defaultValue={detail.responses[criterion.code]?.comments ?? ""}
                      disabled={!editable}
                      maxLength={1000}
                      name={`comments-${criterion.code}`}
                      rows={2}
                    />
                  </label>
                </fieldset>
              ))}
            </div>
          </section>
        ))}
        {reviewing ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <p className="font-semibold">Review before submission</p>
            <ul className="mt-2 space-y-1">
              {criteriaSections().flatMap((section) => section.criteria).map((criterion) => (
                <li key={criterion.code}>
                  {criterion.title}: {ratingLabel(reviewRatings[criterion.code] ?? null)}
                </li>
              ))}
            </ul>
            <p className="mt-2">Confirm that every rating above is the selection currently shown in the form.</p>
            <input name="confirm" type="hidden" value="yes" />
          </div>
        ) : null}
        {editable ? (
          <div className="flex flex-wrap gap-2">
            {reviewing ? (
              <>
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => setReviewing(false)} type="button">
                  Back to form
                </button>
                <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={submitting} type="submit">
                  Submit evaluation
                </button>
              </>
            ) : (
              <>
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" disabled={saving} type="submit">
                  Save draft
                </button>
                <button
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                  onClick={(event) => {
                    const form = event.currentTarget.form;
                    if (!form?.reportValidity()) {
                      return;
                    }
                    const data = new FormData(form);
                    const next: Record<string, string> = {};
                    for (const [key, value] of data.entries()) {
                      if (key.startsWith("rating-")) {
                        next[key.slice("rating-".length)] = String(value);
                      }
                    }
                    if (Object.keys(next).length < 11) {
                      return;
                    }
                    setReviewRatings(next);
                    setReviewing(true);
                  }}
                  type="button"
                >
                  Review submission
                </button>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            {actor === "hr"
              ? "This copy is read-only. Use the HR result section to score, recommend, or release it."
              : "This form is locked until HR returns it for correction."}
          </p>
        )}
        {draftState.error ? <p className="text-sm text-red-700">{draftState.error}</p> : null}
        {draftState.success ? <p className="text-sm text-green-800">{draftState.success}</p> : null}
        {submitState.error ? <p className="text-sm text-red-700">{submitState.error}</p> : null}
        {submitState.success ? <p className="text-sm text-green-800">{submitState.success}</p> : null}
      </form>
      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">Completed form upload</h3>
        <p className="mt-1 text-sm text-slate-600">PDF, Word, or JPG/PNG up to 5 MB. Uploading a file does not submit the evaluation.</p>
        {actor === "supervisor" && (editable || assessment.workflowStatus === "submitted") ? (
          <form action={upload} className="mt-3 flex flex-wrap items-end gap-2">
            <input name="assessmentId" type="hidden" value={assessment.id} />
            <input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,image/jpeg,image/png" name="file" type="file" />
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={uploading} type="submit">
              Upload file
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Uploads are closed after HR accepts the evaluation.</p>
        )}
        {uploadState.error ? <p className="mt-2 text-sm text-red-700">{uploadState.error}</p> : null}
        {uploadState.success ? <p className="mt-2 text-sm text-green-800">{uploadState.success}</p> : null}
        <ul className="mt-3 space-y-1">
          {detail.files.map((file) => (
            <li key={file.id}>
              <EvaluationFileButton fileId={file.id} fileName={file.fileName} />
            </li>
          ))}
        </ul>
      </section>
      <AcknowledgmentList detail={detail} />
      {detail.result?.releasedAt ? <ReleasedResult detail={detail} /> : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function labelStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function AcknowledgmentList({ detail }: { detail: EvaluationDetail }) {
  const rated = detail.acknowledgments.find((item) => item.kind === "rated_by");
  const employee = detail.acknowledgments.find((item) => item.kind === "acknowledge_by");
  const hro = detail.acknowledgments.find((item) => item.kind === "noted_by_hro");
  return (
    <section className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
      <h3 className="font-semibold text-slate-950">Acknowledgment</h3>
      <p className="mt-2">Rated by: {rated ? `${rated.actorName} on ${rated.acknowledgedAt}` : "Not recorded"}</p>
      <p>Acknowledge by: {employee ? `${employee.actorName} on ${employee.acknowledgedAt}` : "Not recorded"}</p>
      <p>Noted by Group Head / Operation Manager: Not recorded. SAMS has no Group Head role, so this signature is not claimed.</p>
      <p>Noted by Human Resource Officer: {hro ? `${hro.actorName} on ${hro.acknowledgedAt}` : "Not recorded"}</p>
    </section>
  );
}

function ReleasedResult({ detail }: { detail: EvaluationDetail }) {
  if (!detail.result) {
    return null;
  }
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <h3 className="font-semibold">Released result</h3>
      <p className="mt-2">Official score: {detail.result.officialScore ?? "Not recorded"}</p>
      <p>Rating: {detail.result.calculatedRating ?? "Not calculated. No approved rating configuration matched this score."}</p>
      <p>Feedback: {detail.result.feedback ?? "Not recorded"}</p>
      <p>HRO recommendation: {recommendationLabel(detail.result.recommendation)}</p>
    </section>
  );
}
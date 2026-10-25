"use client";

import { useActionState } from "react";
import {
  saveAssessmentSettings,
  setAssessmentWorkflow,
  syncAssessmentSchedules,
  type AssessmentActionState,
} from "@/app/dashboard/assessment-actions";
import { allowedTransitions } from "@/lib/assessment/schedule";
import type { AssessmentBoard as BoardData } from "@/lib/assessment/queries";

const initialState: AssessmentActionState = { error: null, success: null };

export function AssessmentBoard({
  board,
  actor,
  query = { status: "", evaluation: "", q: "", supervisor: "", from: "", to: "" },
}: {
  board: BoardData;
  actor: "hr" | "supervisor" | "employee";
  query?: {
    status: string;
    evaluation: string;
    q: string;
    supervisor: string;
    from: string;
    to: string;
  };
}) {
  if (!board.ready) {
    return <p className="text-sm text-amber-800" role="alert">{board.message}</p>;
  }
  const visibleItems = board.items.filter((item) => {
    if (query.status && item.displayStatus !== query.status) {
      return false;
    }
    if (query.evaluation && String(item.evaluationNumber) !== query.evaluation) {
      return false;
    }
    if (query.supervisor && !(item.supervisorName ?? "").toLowerCase().includes(query.supervisor.toLowerCase())) {
      return false;
    }
    if (query.from && item.dueDate < query.from) {
      return false;
    }
    if (query.to && item.dueDate > query.to) {
      return false;
    }
    const haystack = `${item.employeeName} ${item.employeeNumber ?? ""}`.toLowerCase();
    return !query.q || haystack.includes(query.q.toLowerCase());
  });

  return (
    <section aria-labelledby="assessment-board-heading">
      <h2 className="text-lg font-semibold text-slate-900" id="assessment-board-heading">
        Assessment schedule
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
        Statuses come from the saved intervals and tracking workflow. Released scores and the
        final Passed or Not Passed decision are not part of this phase.
      </p>
      {board.message ? <p className="mt-2 text-sm text-amber-800">{board.message}</p> : null}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(board.counts).map(([label, value]) => (
          <div className="rounded-lg border border-slate-200 p-3" key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-xl font-bold text-slate-950">{value}</dd>
          </div>
        ))}
      </dl>
      {actor === "hr" ? <SettingsForm board={board} /> : null}
      {actor === "hr" ? <MissingList board={board} /> : null}
      <form className="mt-4 grid gap-3 sm:grid-cols-4" method="get">
        <label className="text-sm font-medium text-slate-700">
          Status
          <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={query.status} name="status">
            <option value="">All</option>
            {Object.keys(board.counts).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Evaluation
          <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={query.evaluation} name="evaluation">
            <option value="">All</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Search
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={query.q} name="q" type="search" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Supervisor
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={query.supervisor} name="supervisor" type="search" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Due from
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={query.from} name="from" type="date" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Due to
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={query.to} name="to" type="date" />
        </label>
        <button className="self-end rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white" type="submit">
          Apply
        </button>
      </form>
      <div className="mt-4 space-y-3">
        {visibleItems.length ? visibleItems.map((item) => (
          <article className="rounded-lg border border-slate-200 p-4" key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  {item.employeeName} · Evaluation {item.evaluationNumber}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {item.employeeNumber ?? "No employee number"} · Start {item.startDate} · Due {item.dueDate}
                </p>
                <p className="text-sm text-slate-600">
                  {item.supervisorName ?? "No supervisor"} · {item.postName ?? "No post"}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {item.displayStatus}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Updated {item.updatedAt}</p>
            {item.latestNote ? <p className="mt-2 text-sm text-slate-700">{item.latestNote}</p> : null}
            {actor === "employee" ? (
              <p className="mt-2 text-sm text-slate-600">Results are not released.</p>
            ) : (
              <WorkflowForm
                actor={actor}
                assessmentId={item.id}
                status={item.workflowStatus}
              />
            )}
            <EventList assessmentId={item.id} events={board.events} />
          </article>
        )) : (
          <p className="text-sm text-slate-600">No evaluations match this view.</p>
        )}
      </div>
    </section>
  );
}

function SettingsForm({ board }: { board: BoardData }) {
  const [state, action, pending] = useActionState(saveAssessmentSettings, initialState);
  const [syncState, syncAction, syncing] = useActionState(syncAssessmentSchedules, initialState);
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <form action={action} className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Intervals after start date</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumberField label="Evaluation 1 days" name="evaluation1" value={board.settings?.evaluation1OffsetDays} />
          <NumberField label="Evaluation 2 days" name="evaluation2" value={board.settings?.evaluation2OffsetDays} />
          <NumberField label="Evaluation 3 days" name="evaluation3" value={board.settings?.evaluation3OffsetDays} />
          <NumberField label="Due-soon days" name="dueSoon" value={board.settings?.dueSoonDays} />
        </div>
        <button className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={pending} type="submit">
          Save intervals
        </button>
        {state.error ? <p className="mt-2 text-sm text-red-700">{state.error}</p> : null}
        {state.success ? <p className="mt-2 text-sm text-green-800">{state.success}</p> : null}
      </form>
      <form action={syncAction} className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Synchronize schedules</h3>
        <p className="mt-2 text-sm text-slate-600">
          Creates missing Evaluation 1–3 rows and updates due dates only while the workflow is still scheduled.
        </p>
        <button className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={syncing} type="submit">
          Synchronize
        </button>
        {syncState.error ? <p className="mt-2 text-sm text-red-700">{syncState.error}</p> : null}
        {syncState.success ? <p className="mt-2 text-sm text-green-800">{syncState.success}</p> : null}
      </form>
    </div>
  );
}

function MissingList({ board }: { board: BoardData }) {
  if (!board.missingSchedules.length) {
    return null;
  }
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <h3 className="font-semibold">Missing or blocked schedules</h3>
      <ul className="mt-2 list-disc pl-5">
        {board.missingSchedules.map((item) => (
          <li key={item.id}>{item.name}: {item.reason}</li>
        ))}
      </ul>
    </div>
  );
}

function WorkflowForm({
  actor,
  assessmentId,
  status,
}: {
  actor: "hr" | "supervisor";
  assessmentId: string;
  status: BoardData["items"][number]["workflowStatus"];
}) {
  const [state, action, pending] = useActionState(setAssessmentWorkflow, initialState);
  const transitions = allowedTransitions(status, actor);
  if (!transitions.length) {
    return null;
  }
  return (
    <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <input name="assessmentId" type="hidden" value={assessmentId} />
      <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="note" placeholder="Note, required when returning" type="text" />
      <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="nextStatus">
        {transitions.map((transition) => (
          <option key={transition} value={transition}>{transition.replaceAll("_", " ")}</option>
        ))}
      </select>
      <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={pending} type="submit">
        Update status
      </button>
      {state.error ? <p className="text-sm text-red-700 sm:col-span-3">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-800 sm:col-span-3">{state.success}</p> : null}
    </form>
  );
}

function EventList({
  assessmentId,
  events,
}: {
  assessmentId: string;
  events: BoardData["events"];
}) {
  const rows = events.filter((event) => event.assessmentId === assessmentId).slice(0, 5);
  if (!rows.length) {
    return null;
  }
  return (
    <ul className="mt-3 space-y-1 text-xs text-slate-600">
      {rows.map((event) => (
        <li key={event.id}>
          {event.createdAt}: {event.previousStatus ?? "none"} → {event.newStatus}
          {event.note ? ` · ${event.note}` : ""}
        </li>
      ))}
    </ul>
  );
}

function NumberField({ label, name, value }: { label: string; name: string; value: number | null | undefined }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={value ?? ""} min={0} name={name} type="number" />
    </label>
  );
}

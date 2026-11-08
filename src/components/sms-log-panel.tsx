"use client";

import { useActionState } from "react";
import {
  retryLoggedSms,
  runSmsReminderCheck,
  saveSmsReminderInterval,
  type SmsActionState,
} from "@/app/dashboard/hr/sms-actions";
import { canRetrySms, SMS_DELIVERY_STATUSES, SMS_NOTIFICATION_TYPES, smsTypeLabel } from "@/lib/notifications/sms-policy";
import type { SmsLogView } from "@/lib/notifications/sms-queries";

const initialState: SmsActionState = { error: null, success: null };

export function SmsLogPanel({ view }: { view: SmsLogView }) {
  const [settingsState, saveSettings, settingsPending] = useActionState(saveSmsReminderInterval, initialState);
  const [runState, runCheck, runPending] = useActionState(runSmsReminderCheck, initialState);

  return (
    <section aria-labelledby="sms-log-heading" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900" id="sms-log-heading">SMS notifications</h2>
      </div>

      <form action={saveSettings} className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">Reminder interval</h3>
        <p className="mt-1 text-sm text-slate-600">No interval is assumed. Reminders are skipped until this is saved.</p>
        <label className="mt-3 block max-w-xs text-sm font-medium text-slate-700">
          Days between reminder checks for the same evaluation
          <input
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2"
            defaultValue={view.reminderIntervalDays ?? ""}
            max={90}
            min={1}
            name="reminderIntervalDays"
            required
            type="number"
          />
        </label>
        <button className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" disabled={settingsPending} type="submit">
          Save interval
        </button>
        <ActionMessage state={settingsState} />
      </form>

      <form action={runCheck}>
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900" disabled={runPending} type="submit">
          Run reminder check
        </button>
        <ActionMessage state={runState} />
      </form>

      <form className="grid gap-3 md:grid-cols-5" method="get">
        <label className="text-sm font-medium text-slate-700">
          Employee
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={view.filters.q} name="q" placeholder="Name or employee ID" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Type
          <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={view.filters.type} name="type">
            <option value="">All</option>
            {SMS_NOTIFICATION_TYPES.map((type) => (
              <option key={type} value={type}>{smsTypeLabel(type)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Status
          <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={view.filters.status} name="status">
            <option value="">All</option>
            {SMS_DELIVERY_STATUSES.map((status) => (
              <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          From
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={view.filters.from} name="from" type="date" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          To
          <input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={view.filters.to} name="to" type="date" />
        </label>
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white md:col-span-5 md:w-fit" type="submit">
          Apply filters
        </button>
      </form>

      {view.message ? <p className="text-sm text-amber-800">{view.message}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">When</th>
              <th className="px-3 py-2 font-semibold">Employee</th>
              <th className="px-3 py-2 font-semibold">Recipient</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Provider ID</th>
              <th className="px-3 py-2 font-semibold">Failure</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.length ? view.rows.map((row) => (
              <tr className="border-t border-slate-200 align-top" key={row.id}>
                <td className="px-3 py-2 whitespace-nowrap">{formatWhen(row.createdAt)}</td>
                <td className="px-3 py-2">{row.employeeName}{row.employeeNumber ? ` (${row.employeeNumber})` : ""}</td>
                <td className="px-3 py-2">{row.recipientName}<br />{row.recipientPhone || "No number"}</td>
                <td className="px-3 py-2">{smsTypeLabel(row.notificationType)}</td>
                <td className="px-3 py-2">
                  {row.deliveryStatus.replace(/_/g, " ")}
                  <br />
                  <span className="text-slate-500">Attempts {row.attemptCount}</span>
                  {canRetrySms({
                    status: row.deliveryStatus,
                    attemptCount: row.attemptCount,
                    providerMessageId: row.providerMessageId,
                    retryable: row.retryable,
                  }) ? <RetryForm id={row.id} /> : null}
                </td>
                <td className="px-3 py-2">{row.providerMessageId || row.provider || "Not assigned"}</td>
                <td className="px-3 py-2">{row.errorMessage || (row.deliveredAt ? `Delivered ${formatWhen(row.deliveredAt)}` : "None")}</td>
              </tr>
            )) : (
              <tr>
                <td className="px-3 py-4 text-slate-600" colSpan={7}>No SMS notifications match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RetryForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(retryLoggedSms, initialState);
  return (
    <form action={action} className="mt-2">
      <input name="id" type="hidden" value={id} />
      <button className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold" disabled={pending} type="submit">
        Retry
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function ActionMessage({ state }: { state: SmsActionState }) {
  if (state.error) {
    return <p className="mt-2 text-sm text-red-700">{state.error}</p>;
  }
  if (state.success) {
    return <p className="mt-2 text-sm text-green-800">{state.success}</p>;
  }
  return null;
}

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

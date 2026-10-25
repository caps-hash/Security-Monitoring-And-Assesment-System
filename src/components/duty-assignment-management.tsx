"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  saveDutyConfiguration,
  setDutyConfigurationActive,
  type ActionState,
  type DutyActionState,
} from "@/app/dashboard/hr/actions";
import {
  dutyOptionsAvailable,
  formatShiftWindow,
  isOvernightShift,
  normalizeClockTime,
  sharedDutyWarning,
} from "@/lib/personnel/duty-configuration";
import type {
  DutyConfigurationRecord,
  UnlinkedDutyRecord,
} from "@/lib/personnel/duty-management";

const initialDutyState: DutyActionState = {
  error: null,
  success: null,
  configurationId: null,
};
const initialStatusState: ActionState = { error: null, success: null };

type FormMode = "create" | "edit" | "view";

type Draft = {
  configurationId: string;
  postId: string;
  locationId: string;
  shiftId: string;
  postName: string;
  postDescription: string;
  locationName: string;
  locationAddress: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

const emptyDraft: Draft = {
  configurationId: "",
  postId: "",
  locationId: "",
  shiftId: "",
  postName: "",
  postDescription: "",
  locationName: "",
  locationAddress: "",
  shiftName: "",
  startTime: "08:00",
  endTime: "16:00",
  isActive: true,
};

function draftFrom(record: DutyConfigurationRecord): Draft {
  return {
    configurationId: record.id ?? "",
    postId: record.postId,
    locationId: record.locationId,
    shiftId: record.shiftId,
    postName: record.postName,
    postDescription: record.postDescription ?? "",
    locationName: record.locationName,
    locationAddress: record.locationAddress ?? "",
    shiftName: record.shiftName,
    startTime: normalizeClockTime(record.startTime),
    endTime: normalizeClockTime(record.endTime),
    isActive: dutyOptionsAvailable(
      record.postActive,
      record.locationActive,
      record.shiftActive,
    ),
  };
}

function recordKey(record: DutyConfigurationRecord): string {
  return record.id ?? `${record.postId}:${record.locationId}:${record.shiftId}`;
}

function Feedback({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (error) {
    return (
      <p aria-live="polite" className="text-sm text-red-700" role="alert">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p aria-live="polite" className="text-sm text-emerald-700" role="status">
        {success}
      </p>
    );
  }
  return null;
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  readOnly = false,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none read-only:bg-slate-50 focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        required={required}
        type={type}
        value={value}
      />
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function DutyAssignmentManagement({
  configurations,
  unlinked,
}: {
  configurations: DutyConfigurationRecord[];
  unlinked: UnlinkedDutyRecord[];
}) {
  const [state, formAction, pending] = useActionState(
    saveDutyConfiguration,
    initialDutyState,
  );
  const [statusState, statusAction, statusPending] = useActionState(
    setDutyConfigurationActive,
    initialStatusState,
  );
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [baseline, setBaseline] = useState(JSON.stringify(emptyDraft));
  const [mode, setMode] = useState<FormMode>("create");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "inactive">(
    "all",
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== baseline;
  const readOnly = mode === "view";
  const busy = pending || statusPending;

  const selected = configurations.find((item) => recordKey(item) === selectedKey) ?? null;
  const warning = useMemo(() => {
    if (selected && draft.postId === selected.postId) {
      return sharedDutyWarning({
        sharedPostUses: selected.sharedPostUses,
        sharedLocationUses: selected.sharedLocationUses,
        sharedShiftUses: selected.sharedShiftUses,
        assignmentCount: selected.assignmentCount,
        deactivating: !draft.isActive,
      });
    }
    const reused = configurations.some(
      (item) =>
        (draft.postId && item.postId === draft.postId) ||
        (draft.locationId && item.locationId === draft.locationId) ||
        (draft.shiftId && item.shiftId === draft.shiftId),
    );
    return reused
      ? "The selected post, location, or shift is already used by another duty configuration. Saving updates that shared record for every assignment that references it."
      : null;
  }, [configurations, draft, selected]);
  const needsAcknowledgement = Boolean(warning);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  if (
    state.success &&
    state.configurationId &&
    appliedSuccess !== state.success
  ) {
    const match = configurations.find((item) => item.id === state.configurationId);
    if (match) {
      const next = draftFrom(match);
      setAppliedSuccess(state.success);
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setMode("edit");
      setSelectedKey(recordKey(match));
    }
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function confirmDiscard(): boolean {
    return !dirty || window.confirm("Discard unsaved changes?");
  }

  function loadRecord(record: DutyConfigurationRecord, nextMode: FormMode) {
    if (!confirmDiscard()) {
      return;
    }
    const next = draftFrom(record);
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setMode(nextMode);
    setSelectedKey(recordKey(record));
  }

  function startNew() {
    if (!confirmDiscard()) {
      return;
    }
    setDraft(emptyDraft);
    setBaseline(JSON.stringify(emptyDraft));
    setMode("create");
    setSelectedKey(null);
  }

  function applyUnlinked(record: UnlinkedDutyRecord) {
    if (!confirmDiscard()) {
      return;
    }
    const next: Draft = {
      ...emptyDraft,
      postId: record.kind === "post" ? record.id : "",
      locationId: record.kind === "location" ? record.id : "",
      shiftId: record.kind === "shift" ? record.id : "",
      postName: record.kind === "post" ? record.name : "",
      postDescription: record.kind === "post" ? record.detail ?? "" : "",
      locationName: record.kind === "location" ? record.name : "",
      locationAddress: record.kind === "location" ? record.detail ?? "" : "",
      shiftName: record.kind === "shift" ? record.name : "",
      isActive: record.isActive,
    };
    setDraft(next);
    setBaseline(JSON.stringify(emptyDraft));
    setMode("create");
    setSelectedKey(null);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleConfigurations = configurations.filter((item) => {
    const available = dutyOptionsAvailable(
      item.postActive,
      item.locationActive,
      item.shiftActive,
    );
    if (statusFilter === "available" && !available) {
      return false;
    }
    if (statusFilter === "inactive" && available) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return [
      item.postName,
      item.postDescription,
      item.locationName,
      item.locationAddress,
      item.shiftName,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <section aria-labelledby="duty-assignment-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className="text-lg font-semibold text-slate-900"
            id="duty-assignment-heading"
          >
            Duty Assignment Management
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Save a post, duty location, and duty shift together. This does not
            create or change an employee assignment.
          </p>
        </div>
        <button
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          onClick={startNew}
          type="button"
        >
          New configuration
        </button>
      </div>

      <form
        action={formAction}
        aria-busy={pending}
        className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={(event) => {
          if (readOnly) {
            event.preventDefault();
            return;
          }
          if (needsAcknowledgement) {
            const acknowledged = new FormData(event.currentTarget).get(
              "acknowledge_shared",
            );
            if (acknowledged !== "on") {
              event.preventDefault();
              window.alert("Confirm the shared-record warning before saving.");
            }
          }
        }}
      >
        <input name="configuration_id" type="hidden" value={draft.configurationId} />
        <input name="post_id" type="hidden" value={draft.postId} />
        <input name="location_id" type="hidden" value={draft.locationId} />
        <input name="shift_id" type="hidden" value={draft.shiftId} />
        <p className="text-sm font-semibold text-slate-900">
          {mode === "create"
            ? "New duty configuration"
            : mode === "view"
              ? "View duty configuration"
              : "Edit duty configuration"}
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <fieldset className="min-w-0 space-y-3">
            <legend className="text-sm font-semibold text-slate-900">Post information</legend>
            <Field
              label="Post name"
              name="post_name"
              onChange={(postName) => updateDraft({ postName })}
              readOnly={readOnly}
              required
              value={draft.postName}
            />
            <Field
              label="Post description"
              name="post_description"
              onChange={(postDescription) => updateDraft({ postDescription })}
              readOnly={readOnly}
              value={draft.postDescription}
            />
          </fieldset>
          <fieldset className="min-w-0 space-y-3">
            <legend className="text-sm font-semibold text-slate-900">
              Duty location information
            </legend>
            <Field
              label="Duty location name"
              name="location_name"
              onChange={(locationName) => updateDraft({ locationName })}
              readOnly={readOnly}
              required
              value={draft.locationName}
            />
            <Field
              label="Address"
              name="location_address"
              onChange={(locationAddress) => updateDraft({ locationAddress })}
              readOnly={readOnly}
              value={draft.locationAddress}
            />
          </fieldset>
          <fieldset className="min-w-0 space-y-3">
            <legend className="text-sm font-semibold text-slate-900">
              Duty shift information
            </legend>
            <Field
              label="Shift name"
              name="shift_name"
              onChange={(shiftName) => updateDraft({ shiftName })}
              readOnly={readOnly}
              required
              value={draft.shiftName}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Start time"
                name="start_time"
                onChange={(startTime) => updateDraft({ startTime })}
                readOnly={readOnly}
                required
                type="time"
                value={draft.startTime}
              />
              <Field
                label="End time"
                name="end_time"
                onChange={(endTime) => updateDraft({ endTime })}
                readOnly={readOnly}
                required
                type="time"
                value={draft.endTime}
              />
            </div>
            {isOvernightShift(draft.startTime, draft.endTime) ? (
              <p className="text-xs leading-5 text-slate-500">
                End time is earlier than start time, so this shift is saved as overnight.
              </p>
            ) : null}
          </fieldset>
        </div>
        <label className="mt-5 flex items-start gap-3 text-sm text-slate-700">
          <input
            checked={draft.isActive}
            className="mt-0.5"
            disabled={readOnly}
            name="is_active"
            onChange={(event) => updateDraft({ isActive: event.target.checked })}
            type="checkbox"
          />
          <span>
            <span className="font-medium">Active and available for new employee assignments</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Inactive options remain on existing assignments. They cannot be used when
              saving a new assignment.
            </span>
          </span>
        </label>
        {warning ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
            <p>{warning}</p>
            {readOnly ? null : (
              <label className="mt-2 flex items-start gap-2 font-medium">
                <input className="mt-1" name="acknowledge_shared" type="checkbox" />
                I understand this can affect every assignment using the shared record.
              </label>
            )}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {readOnly ? (
            <button
              className="rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
              onClick={() => setMode("edit")}
              type="button"
            >
              Edit
            </button>
          ) : (
            <button
              className="rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              {pending ? "Saving..." : "Save Changes"}
            </button>
          )}
          <Feedback error={state.error} success={state.success} />
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Saved configurations</h3>
          <Feedback error={statusState.error} success={statusState.success} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="block text-sm font-medium text-slate-700">
            Search
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Post, location, shift, or address"
              type="search"
              value={query}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Status
            <select
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | "available" | "inactive")
              }
              value={statusFilter}
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        {statusPending ? (
          <p aria-live="polite" className="mt-3 text-sm text-slate-600" role="status">
            Updating status...
          </p>
        ) : null}
        {visibleConfigurations.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[46rem] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 font-semibold" scope="col">Post</th>
                  <th className="px-2 py-2 font-semibold" scope="col">Duty location</th>
                  <th className="px-2 py-2 font-semibold" scope="col">Duty shift</th>
                  <th className="px-2 py-2 font-semibold" scope="col">Start time – end time</th>
                  <th className="px-2 py-2 font-semibold" scope="col">Status</th>
                  <th className="px-2 py-2 font-semibold" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleConfigurations.map((item) => {
                  const available = dutyOptionsAvailable(
                    item.postActive,
                    item.locationActive,
                    item.shiftActive,
                  );
                  const itemWarning = sharedDutyWarning({
                    sharedPostUses: item.sharedPostUses,
                    sharedLocationUses: item.sharedLocationUses,
                    sharedShiftUses: item.sharedShiftUses,
                    assignmentCount: item.assignmentCount,
                    deactivating: available,
                  });
                  return (
                    <tr className="border-b border-slate-100 align-top" key={recordKey(item)}>
                      <td className="px-2 py-3 font-medium text-slate-900">{item.postName}</td>
                      <td className="px-2 py-3 text-slate-700">
                        {item.locationName}
                        {item.locationAddress ? (
                          <span className="mt-1 block text-xs text-slate-500">
                            {item.locationAddress}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-3 text-slate-700">{item.shiftName}</td>
                      <td className="px-2 py-3 text-slate-700">
                        {formatShiftWindow(item.startTime, item.endTime)}
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={
                            available
                              ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                              : "rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                          }
                        >
                          {available ? "Available" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md px-2 py-1 font-semibold text-blue-900 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
                            onClick={() => loadRecord(item, "view")}
                            type="button"
                          >
                            View
                          </button>
                          <button
                            className="rounded-md px-2 py-1 font-semibold text-blue-900 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
                            onClick={() => loadRecord(item, "edit")}
                            type="button"
                          >
                            Edit
                          </button>
                          <form
                            action={statusAction}
                            onSubmit={(event) => {
                              if (dirty && !window.confirm("Discard unsaved changes?")) {
                                event.preventDefault();
                                return;
                              }
                              if (
                                itemWarning &&
                                !window.confirm(itemWarning)
                              ) {
                                event.preventDefault();
                              }
                            }}
                          >
                            <input name="configuration_id" type="hidden" value={item.id ?? ""} />
                            <input name="post_id" type="hidden" value={item.postId} />
                            <input name="location_id" type="hidden" value={item.locationId} />
                            <input name="shift_id" type="hidden" value={item.shiftId} />
                            <input name="active" type="hidden" value={String(!available)} />
                            <input name="acknowledge_shared" type="hidden" value="true" />
                            <button
                              className="rounded-md px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 disabled:opacity-60"
                              disabled={busy}
                              type="submit"
                            >
                              {available ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            {configurations.length
              ? "No configurations match this search or status filter."
              : "No duty configurations yet. Enter a post, location, and shift, then choose Save Changes."}
          </p>
        )}
      </div>

      {unlinked.length ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Records not in a configuration
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            These posts, locations, or shifts are not paired with the other two
            records. Add one to the form instead of creating a duplicate.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {unlinked.map((record) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                key={`${record.kind}-${record.id}`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{record.name}</p>
                  <p className="text-xs text-slate-500">
                    {record.kind === "post"
                      ? "Post"
                      : record.kind === "location"
                        ? "Duty location"
                        : "Duty shift"}
                    {record.detail ? ` · ${record.detail}` : ""}
                    {record.isActive ? "" : " · Inactive"}
                  </p>
                </div>
                <button
                  className="rounded-md px-2 py-1 text-sm font-semibold text-blue-900 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
                  onClick={() => applyUnlinked(record)}
                  type="button"
                >
                  Use in form
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

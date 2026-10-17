"use client";

import { useActionState } from "react";
import {
  createStaffAccount,
  saveAssignment,
  saveLookup,
  setStaffActive,
  updateStaffProfile,
  type ActionState,
} from "@/app/dashboard/hr/actions";
import type {
  HRStaffMember,
  LookupItem,
  StaffProfile,
} from "@/lib/personnel/types";

const initialState: ActionState = { error: null, success: null };

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p aria-live="polite" className="mt-3 text-sm text-red-700" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p aria-live="polite" className="mt-3 text-sm text-emerald-700" role="status">
        {state.success}
      </p>
    );
  }
  return null;
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: string;
}) {
  return (
    <button
      className="rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : children}
    </button>
  );
}

function TextField({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | null;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
        defaultValue={defaultValue ?? ""}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function CreateStaffForm() {
  const [state, formAction, pending] = useActionState(
    createStaffAccount,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          autoComplete="given-name"
          label="First name"
          name="first_name"
          required
        />
        <TextField
          autoComplete="family-name"
          label="Last name"
          name="last_name"
          required
        />
        <TextField
          autoComplete="email"
          label="Email address"
          name="email"
          required
          type="email"
        />
        <label className="block text-sm font-medium text-slate-700">
          Account type
          <select
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
            defaultValue="employee"
            name="role"
          >
            <option value="employee">Employee</option>
            <option value="supervisor">Supervisor</option>
          </select>
        </label>
        <TextField label="Employee number" name="employee_number" />
        <TextField
          autoComplete="tel"
          label="Phone number"
          name="phone"
          type="tel"
        />
      </div>
      <p className="text-xs leading-5 text-slate-500">
        An account invitation will be emailed. The user must accept it to set up
        their sign-in.
      </p>
      <SubmitButton pending={pending}>Send invitation</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

function StaffProfileForm({ member }: { member: StaffProfile }) {
  const [state, formAction, pending] = useActionState(
    updateStaffProfile,
    initialState,
  );
  const prefix = `staff-${member.id}`;

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <input name="id" type="hidden" value={member.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          defaultValue={member.first_name}
          label="First name"
          name="first_name"
          required
        />
        <TextField
          defaultValue={member.last_name}
          label="Last name"
          name="last_name"
          required
        />
        <TextField
          defaultValue={member.employee_number}
          label="Employee number"
          name="employee_number"
        />
        <TextField
          defaultValue={member.phone}
          label="Phone number"
          name="phone"
          type="tel"
        />
      </div>
      <p className="text-xs text-slate-500" id={`${prefix}-email`}>
        Account email: {member.email}
      </p>
      <SubmitButton pending={pending}>Save profile</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

function StaffActiveForm({ member }: { member: StaffProfile }) {
  const [state, formAction, pending] = useActionState(
    setStaffActive,
    initialState,
  );

  return (
    <form action={formAction} className="mt-3">
      <input name="id" type="hidden" value={member.id} />
      <input name="active" type="hidden" value={String(!member.is_active)} />
      <button
        className={
          member.is_active
            ? "rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            : "rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
        }
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Updating..."
          : member.is_active
            ? "Deactivate account"
            : "Activate account"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function SelectField({
  label,
  name,
  options,
  selected,
}: {
  label: string;
  name: string;
  options: { id: string; name: string }[];
  selected?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
        defaultValue={selected ?? ""}
        name={name}
        required
      >
        <option disabled value="">
          Select {label.toLowerCase()}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function AssignmentForm({
  member,
  supervisors,
  posts,
  locations,
  shifts,
}: {
  member: HRStaffMember;
  supervisors: StaffProfile[];
  posts: LookupItem[];
  locations: LookupItem[];
  shifts: LookupItem[];
}) {
  const [state, formAction, pending] = useActionState(
    saveAssignment,
    initialState,
  );
  const assignment = member.assignment;

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <input name="employee_id" type="hidden" value={member.profile.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Supervisor"
          name="supervisor_id"
          options={supervisors.map((supervisor) => ({
            id: supervisor.id,
            name: `${supervisor.first_name} ${supervisor.last_name}`.trim() || supervisor.email,
          }))}
          selected={assignment?.supervisor_id}
        />
        <SelectField
          label="Post"
          name="post_id"
          options={posts}
          selected={assignment?.post_id}
        />
        <SelectField
          label="Duty location"
          name="duty_location_id"
          options={locations}
          selected={assignment?.duty_location_id}
        />
        <SelectField
          label="Duty shift"
          name="duty_shift_id"
          options={shifts.map((shift) => ({
            id: shift.id,
            name: `${shift.name} (${shift.start_time?.slice(0, 5)}–${shift.end_time?.slice(0, 5)})`,
          }))}
          selected={assignment?.duty_shift_id}
        />
        <TextField
          defaultValue={assignment?.start_date}
          label="Start date at post"
          name="start_date"
          required
          type="date"
        />
      </div>
      <SubmitButton pending={pending}>Save assignment</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

function LookupForm({
  kind,
  item,
}: {
  kind: "posts" | "duty_locations" | "duty_shifts";
  item?: LookupItem;
}) {
  const [state, formAction, pending] = useActionState(saveLookup, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg bg-slate-50 p-3">
      <input name="kind" type="hidden" value={kind} />
      {item ? <input name="id" type="hidden" value={item.id} /> : null}
      <TextField label="Name" name="name" defaultValue={item?.name} required />
      {kind === "posts" ? (
        <TextField
          label="Description"
          name="description"
          defaultValue={item?.description}
        />
      ) : null}
      {kind === "duty_locations" ? (
        <TextField
          label="Address"
          name="address"
          defaultValue={item?.address}
        />
      ) : null}
      {kind === "duty_shifts" ? (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            defaultValue={item?.start_time?.slice(0, 5) ?? "08:00"}
            label="Start"
            name="start_time"
            required
            type="time"
          />
          <TextField
            defaultValue={item?.end_time?.slice(0, 5) ?? "16:00"}
            label="End"
            name="end_time"
            required
            type="time"
          />
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          defaultChecked={item?.is_active ?? true}
          name="is_active"
          type="checkbox"
        />
        Active and available for assignments
      </label>
      <SubmitButton pending={pending}>
        {item ? "Save changes" : "Add"}
      </SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

function LookupPanel({
  title,
  kind,
  items,
}: {
  title: string;
  kind: "posts" | "duty_locations" | "duty_shifts";
  items: LookupItem[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">
        <LookupForm kind={kind} />
        {items.length ? (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            {items.map((item) => (
              <div key={item.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {item.is_active ? "Active" : "Inactive"} item
                </p>
                <LookupForm item={item} kind={kind} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function HRManagement({
  staff,
  supervisors,
  posts,
  locations,
  shifts,
}: {
  staff: HRStaffMember[];
  supervisors: StaffProfile[];
  posts: LookupItem[];
  locations: LookupItem[];
  shifts: LookupItem[];
}) {
  const employees = staff.filter(({ profile }) => profile.role === "employee");
  const supervisorProfiles = staff.filter(
    ({ profile }) => profile.role === "supervisor",
  );

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-semibold text-slate-900">
          Invite employee or supervisor
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Staff receive a secure email invitation to activate their account.
        </p>
        <div className="mt-5">
          <CreateStaffForm />
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Employees</h2>
            <p className="mt-1 text-sm text-slate-600">
              Edit employee profiles and assign supervisor, post, location,
              shift, and start date.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-900">
            {employees.length} employee{employees.length === 1 ? "" : "s"}
          </span>
        </div>
        {employees.length ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {employees.map((member) => (
              <article
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                key={member.profile.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {[member.profile.first_name, member.profile.last_name]
                        .filter(Boolean)
                        .join(" ") || "Employee"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {member.profile.email}
                    </p>
                  </div>
                  <span
                    className={
                      member.profile.is_active
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                        : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                    }
                  >
                    {member.profile.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <StaffProfileForm member={member.profile} />
                <StaffActiveForm member={member.profile} />
                <AssignmentForm
                  locations={locations}
                  member={member}
                  posts={posts}
                  shifts={shifts}
                  supervisors={supervisors}
                />
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            No employee accounts yet. Invite an employee above to get started.
          </p>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Supervisors</h2>
            <p className="mt-1 text-sm text-slate-600">
              Manage supervisor profiles and account access.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-900">
            {supervisorProfiles.length} supervisor
            {supervisorProfiles.length === 1 ? "" : "s"}
          </span>
        </div>
        {supervisorProfiles.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {supervisorProfiles.map(({ profile }) => (
              <article
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                key={profile.id}
              >
                <h3 className="font-semibold text-slate-900">
                  {[profile.first_name, profile.last_name]
                    .filter(Boolean)
                    .join(" ") || "Supervisor"}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{profile.email}</p>
                <StaffProfileForm member={profile} />
                <StaffActiveForm member={profile} />
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            No supervisor accounts yet. Invite one above before assigning
            employees.
          </p>
        )}
      </section>

      <section>
        <div>
          <h2 className="text-xl font-bold text-slate-950">
            Posts, locations, and shifts
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Maintain active options for employee assignments. Inactive options
            remain visible on existing assignments.
          </p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <LookupPanel items={posts} kind="posts" title="Posts" />
          <LookupPanel
            items={locations}
            kind="duty_locations"
            title="Duty locations"
          />
          <LookupPanel
            items={shifts}
            kind="duty_shifts"
            title="Duty shifts"
          />
        </div>
      </section>
    </div>
  );
}

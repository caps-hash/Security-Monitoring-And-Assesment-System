"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  createStaffAccount,
  retryStaffNotices,
  saveAssignment,
  setStaffActive,
  updateStaffEmail,
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
  return (
    <>
      {state.error ? (
        <p aria-live="polite" className="mt-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.warning ? (
        <p aria-live="polite" className="mt-3 text-sm text-amber-800" role="status">
          {state.warning}
        </p>
      ) : null}
      {state.success ? (
        <p aria-live="polite" className="mt-3 text-sm text-emerald-700" role="status">
          {state.success}
        </p>
      ) : null}
    </>
  );
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
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form action={formAction} className="space-y-4" ref={formRef}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          autoComplete="given-name"
          label="First name"
          name="first_name"
          required
        />
        <TextField
          autoComplete="additional-name"
          label="Middle name (optional)"
          name="middle_name"
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
            required
          >
            <option value="employee">Employee</option>
            <option value="supervisor">Supervisor</option>
          </select>
        </label>
        <TextField
          autoComplete="tel"
          label="Mobile number"
          name="phone"
          required
          type="tel"
        />
      </div>
      {/* ponytail: assignment stays on the existing employee card so a supervisor can be created before any assignment exists. */}
      <p className="text-xs leading-5 text-slate-500">
        The employee ID is generated automatically. A temporary password is sent
        only by SMS when an SMS provider is configured, and it is never shown
        here. Assignment stays on the employee card after the account exists.
      </p>
      <SubmitButton pending={pending}>Create account</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

function StaffEmailEditor({ member }: { member: StaffProfile }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateStaffEmail, initialState);

  return (
    <div className="mt-3">
      <p className="text-xs text-slate-500">Current email: {member.email}</p>
      {editing ? (
        <form action={formAction} className="mt-3 space-y-3">
          <input name="id" type="hidden" value={member.id} />
          <TextField
            autoComplete="off"
            defaultValue={member.email}
            label="New email address"
            name="email"
            required
            type="email"
          />
          <div className="flex flex-wrap gap-2">
            <SubmitButton pending={pending}>Save email</SubmitButton>
            <button
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setEditing(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
          <Feedback state={state} />
        </form>
      ) : (
        <>
          <button
            className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => setEditing(true)}
            type="button"
          >
            Edit email
          </button>
          <Feedback state={state} />
        </>
      )}
    </div>
  );
}

function StaffProfileForm({ member }: { member: StaffProfile }) {
  const [state, formAction, pending] = useActionState(
    updateStaffProfile,
    initialState,
  );

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
          defaultValue={member.middle_name}
          label="Middle name (optional)"
          name="middle_name"
        />
        <TextField
          defaultValue={member.last_name}
          label="Last name"
          name="last_name"
          required
        />
        <p className="block text-sm font-medium text-slate-700">
          Employee ID
          <span className="mt-1.5 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
            {member.employee_number || "Not assigned"}
          </span>
        </p>
        <TextField
          defaultValue={member.phone}
          label="Mobile number"
          name="phone"
          type="tel"
        />
      </div>
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

function staffName(profile: StaffProfile): string {
  return (
    [profile.first_name, profile.middle_name, profile.last_name]
      .filter(Boolean)
      .join(" ") || profile.email
  );
}

function noticeLabel(status: string | null | undefined): string {
  if (status === "sent") {
    return "Sent";
  }
  if (status === "failed") {
    return "Failed";
  }
  if (status === "not_configured") {
    return "Not configured";
  }
  return "Not recorded";
}

function StaffNoticeRetry({ member }: { member: StaffProfile }) {
  const [state, formAction, pending] = useActionState(retryStaffNotices, initialState);
  const canRetry =
    member.email_notice_status === "failed" ||
    member.email_notice_status === "not_configured" ||
    member.sms_notice_status === "failed" ||
    member.sms_notice_status === "not_configured";

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-sm text-slate-700">
        Email notice: {noticeLabel(member.email_notice_status)}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        SMS notice: {noticeLabel(member.sms_notice_status)}
      </p>
      {canRetry ? (
        <form action={formAction} className="mt-3">
          <input name="id" type="hidden" value={member.id} />
          <SubmitButton pending={pending}>Retry failed notices</SubmitButton>
          <Feedback state={state} />
        </form>
      ) : null}
    </div>
  );
}

function CountBadge({ children }: { children: string }) {
  return (
    <span className="w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
      {children}
    </span>
  );
}

export function CreateAccountPanel() {
  return (
    <section aria-labelledby="create-account-heading">
      <h2 className="text-lg font-semibold text-slate-900" id="create-account-heading">
        Create account
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
        Create an employee or supervisor account. HR does not enter the employee ID.
      </p>
      <div className="mt-5">
        <CreateStaffForm />
      </div>
    </section>
  );
}

function roleLabel(role: StaffProfile["role"]): string {
  if (role === "supervisor") {
    return "Supervisor";
  }
  if (role === "employee") {
    return "Employee";
  }
  return "HR";
}

export function EmployeeDirectory({
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
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "employee" | "supervisor">(
    "all",
  );
  const personnel = staff.filter(
    ({ profile }) => profile.role === "employee" || profile.role === "supervisor",
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePersonnel = personnel.filter(({ profile }) => {
    if (roleFilter !== "all" && profile.role !== roleFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return [
      staffName(profile),
      profile.email,
      profile.employee_number ?? "",
      roleLabel(profile.role),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <section aria-labelledby="employees-heading" className="border-t border-slate-200 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900" id="employees-heading">
            Personnel
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Review employees and supervisors created above. Employee records keep
            supervisor, post, location, shift, and start date assignment.
          </p>
        </div>
        <CountBadge>
          {`${personnel.length} personnel`}
        </CountBadge>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Search personnel
          <input
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email, employee number, or role"
            type="search"
            value={query}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Role
          <select
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
            onChange={(event) => {
              const value = event.target.value;
              if (value === "all" || value === "employee" || value === "supervisor") {
                setRoleFilter(value);
              }
            }}
            value={roleFilter}
          >
            <option value="all">All personnel</option>
            <option value="employee">Employees</option>
            <option value="supervisor">Supervisors</option>
          </select>
        </label>
      </div>
      {visiblePersonnel.length ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {visiblePersonnel.map((member) => (
            <article
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              key={member.profile.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">
                    {staffName(member.profile)}
                  </h3>
                  <p className="mt-1 break-all text-sm text-slate-600">
                    {member.profile.email}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    Employee ID: {member.profile.employee_number || "Not assigned"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">
                    {roleLabel(member.profile.role)}
                  </span>
                  <span
                    className={
                      member.profile.is_active
                        ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                        : "rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                    }
                  >
                    {member.profile.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              {member.profile.role === "employee" && member.assignmentSummary ? (
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Supervisor
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {member.assignmentSummary.supervisor_name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Post
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {member.assignmentSummary.post_name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Duty location
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {member.assignmentSummary.location_name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Duty shift
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {member.assignmentSummary.shift_name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Start date
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {member.assignmentSummary.start_date}
                    </dd>
                  </div>
                </dl>
              ) : member.profile.role === "employee" ? (
                <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                  No assignment yet.
                </p>
              ) : (
                <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  {member.profile.is_active
                    ? "This supervisor can be selected when assigning an employee."
                    : "Inactive supervisors are hidden from new employee assignments."}
                </p>
              )}
              <StaffEmailEditor member={member.profile} />
              <StaffProfileForm member={member.profile} />
              <StaffNoticeRetry member={member.profile} />
              <StaffActiveForm member={member.profile} />
              {member.profile.role === "employee" ? (
                <AssignmentForm
                  locations={locations}
                  member={member}
                  posts={posts}
                  shifts={shifts}
                  supervisors={supervisors}
                />
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          {personnel.length
            ? "No personnel match that search or role filter."
            : "No employee or supervisor accounts yet. Create an account above to get started."}
        </p>
      )}
    </section>
  );
}

export function SupervisorDirectory({ staff }: { staff: HRStaffMember[] }) {
  const supervisors = staff.filter(({ profile }) => profile.role === "supervisor");

  return (
    <section aria-labelledby="supervisors-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900" id="supervisors-heading">
            Supervisors
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Manage supervisor profiles and account access.{" "}
            <Link
              className="font-semibold text-blue-900 hover:text-blue-700"
              href="/dashboard/hr/personnel"
            >
              Create a supervisor from Personnel
            </Link>{" "}
            before assigning employees.
          </p>
        </div>
        <CountBadge>
          {`${supervisors.length} supervisor${supervisors.length === 1 ? "" : "s"}`}
        </CountBadge>
      </div>
      {supervisors.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {supervisors.map(({ profile }) => (
            <article
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              key={profile.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{staffName(profile)}</h3>
                  <p className="mt-1 break-all text-sm text-slate-600">{profile.email}</p>
                </div>
                <span
                  className={
                    profile.is_active
                      ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                      : "rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                  }
                >
                  {profile.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <StaffEmailEditor member={profile} />
              <StaffProfileForm member={profile} />
              <StaffNoticeRetry member={profile} />
              <StaffActiveForm member={profile} />
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          No supervisor accounts yet.{" "}
          <Link
            className="font-semibold text-blue-900 hover:text-blue-700"
            href="/dashboard/hr/personnel"
          >
            Create one from Personnel
          </Link>{" "}
          before assigning employees.
        </p>
      )}
    </section>
  );
}

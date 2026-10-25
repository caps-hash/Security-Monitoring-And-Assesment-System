"use server";

import { randomBytes, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import {
  accountCreatedMessage,
  fullStaffName,
  normalizePhone,
  noticeWarning,
  smsProviderName,
  type NoticeResult,
  type NoticeStatus,
} from "@/lib/personnel/account-notices";
import { validateDutyConfigurationInput } from "@/lib/personnel/duty-configuration";
import { assignUniqueEmployeeNumber } from "@/lib/personnel/employee-number";
import {
  interpretStaffEmailChange,
  isStaffInviteRole,
  validateStaffEmail,
  validateStaffInvite,
} from "@/lib/personnel/staff-invite";
import {
  deliverAccountEmail,
  deliverAccountSms,
} from "@/lib/notifications/deliver";

export type ActionState = {
  error: string | null;
  success: string | null;
  warning?: string | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function requireHr() {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    throw new Error("Only HR users can manage personnel.");
  }
  return profile;
}

function failed(message: string): ActionState {
  return { error: message, success: null };
}

function succeeded(message: string): ActionState {
  return { error: null, success: message };
}

function isNoticeStatus(value: string | null): value is NoticeStatus {
  return value === "sent" || value === "failed" || value === "not_configured";
}

async function invalidateUndeliveredPassword(
  userId: string,
  appMetadata: Record<string, unknown>,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: randomBytes(9).toString("base64url"),
    app_metadata: { ...appMetadata, must_change_password: true },
  });
  return error ? "The undelivered temporary password could not be invalidated." : null;
}

export async function createStaffAccount(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHr();

  const email = field(formData, "email").toLowerCase();
  const firstName = field(formData, "first_name");
  const middleName = field(formData, "middle_name");
  const lastName = field(formData, "last_name");
  const phone = field(formData, "phone");
  const role = field(formData, "role");
  const validationError = validateStaffInvite({
    email,
    firstName,
    middleName,
    lastName,
    role,
    phone,
  });

  if (validationError || !isStaffInviteRole(role)) {
    return failed(validationError ?? "Choose Employee or Supervisor.");
  }
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return failed("Enter a valid mobile number with 10 to 15 digits.");
  }

  const admin = createSupabaseAdminClient();
  const { data: existingEmails, error: emailLookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (emailLookupError) {
    return failed(`Could not check existing accounts: ${emailLookupError.message}`);
  }
  if (existingEmails?.length) {
    return failed("An account with this email already exists.");
  }

  const temporaryPassword = randomBytes(9).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
    },
    app_metadata: { must_change_password: true },
  });

  if (error || !data.user) {
    const message = error?.message ?? "Supabase did not return a created user.";
    if (/already|registered|exists/i.test(message)) {
      return failed("An account with this email already exists.");
    }
    return failed(`Could not create this account: ${message}`);
  }

  const createdUserId = data.user.id;
  let employeeNumber = "";
  try {
    employeeNumber = await assignUniqueEmployeeNumber(async (candidate) => {
      const { error: profileError } = await admin.from("profiles").upsert(
        {
          id: createdUserId,
          email: data.user.email?.toLowerCase() || email,
          role,
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          employee_number: candidate,
          phone: normalizedPhone,
          is_active: true,
        },
        { onConflict: "id" },
      );
      if (!profileError) {
        return "ok";
      }
      if (profileError.code === "23505") {
        return "collision";
      }
      throw new Error(profileError.message);
    }, (exclusiveMax) => randomInt(exclusiveMax));
  } catch (profileError) {
    const message =
      profileError instanceof Error ? profileError.message : "The profile could not be saved.";
    const { error: rollbackError } = await admin.auth.admin.deleteUser(createdUserId);
    if (rollbackError) {
      return failed(
        `The account was created, but the profile could not be saved and the Auth account could not be removed: ${message}`,
      );
    }
    return failed(`The profile could not be saved, so the account was removed: ${message}`);
  }

  const smsNotice = smsProviderName()
    ? await deliverAccountSms({
        phone: normalizedPhone,
        employeeNumber,
        temporaryPassword,
      })
    : {
        status: "not_configured" as const,
        detail:
          "SMS is not configured. Set server-only TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM, or SEMAPHORE_API_KEY.",
      };
  const invalidationWarning =
    smsNotice.status === "failed"
      ? await invalidateUndeliveredPassword(createdUserId, { must_change_password: true })
      : null;
  const emailNotice = await deliverAccountEmail({
    email,
    fullName: fullStaffName([firstName, middleName, lastName]),
    employeeNumber,
    smsSent: smsNotice.status === "sent",
  });
  const { error: noticeError } = await admin
    .from("profiles")
    .update({
      email_notice_status: emailNotice.status,
      sms_notice_status: smsNotice.status,
    })
    .eq("id", createdUserId);
  const warning = [
    noticeWarning(emailNotice, smsNotice),
    invalidationWarning,
    noticeError ? "Delivery status could not be saved. The account was still created." : null,
  ]
    .filter(Boolean)
    .join(" ");

  revalidatePath("/dashboard/hr", "layout");
  const created = accountCreatedMessage(role, email, employeeNumber);
  if (warning) {
    return { error: null, success: null, warning: `${created} ${warning}` };
  }
  return succeeded(created);
}

export async function retryStaffNotices(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHr();

  const id = field(formData, "id");
  if (!uuidPattern.test(id)) {
    return failed("The selected staff account is invalid.");
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(
      "id, email, role, first_name, middle_name, last_name, phone, employee_number, email_notice_status, sms_notice_status",
    )
    .eq("id", id)
    .maybeSingle();

  if (profileError) {
    return failed(`Could not load this staff account: ${profileError.message}`);
  }
  if (!profile || (profile.role !== "employee" && profile.role !== "supervisor")) {
    return failed("The staff account was not found.");
  }
  if (!profile.employee_number) {
    return failed("This account has no employee ID, so notices were not retried.");
  }

  const emailNeeds =
    profile.email_notice_status === "failed" ||
    profile.email_notice_status === "not_configured";
  const smsNeeds =
    profile.sms_notice_status === "failed" ||
    profile.sms_notice_status === "not_configured";
  if (!emailNeeds && !smsNeeds) {
    return succeeded("Email and SMS were already sent. Nothing was retried.");
  }

  let smsNotice: NoticeResult = {
    status: isNoticeStatus(profile.sms_notice_status) ? profile.sms_notice_status : "failed",
    detail: "SMS was not retried.",
  };
  if (smsNeeds) {
    if (!profile.phone) {
      smsNotice = { status: "failed", detail: "This profile has no mobile number." };
    } else if (!smsProviderName()) {
      smsNotice = {
        status: "not_configured",
        detail:
          "SMS is not configured. Set server-only TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM, or SEMAPHORE_API_KEY.",
      };
    } else {
      const { data: authUser, error: authError } = await admin.auth.admin.getUserById(profile.id);
      if (authError || !authUser.user) {
        return failed("The authentication account was not found. No new password was sent.");
      }
      const temporaryPassword = randomBytes(9).toString("base64url");
      const { error: passwordError } = await admin.auth.admin.updateUserById(profile.id, {
        password: temporaryPassword,
        app_metadata: {
          ...authUser.user.app_metadata,
          must_change_password: true,
        },
      });
      if (passwordError) {
        return failed("Could not prepare a new temporary password. No SMS was sent.");
      }
      smsNotice = await deliverAccountSms({
        phone: profile.phone,
        employeeNumber: profile.employee_number,
        temporaryPassword,
      });
      if (smsNotice.status !== "sent") {
        const invalidationWarning = await invalidateUndeliveredPassword(
          profile.id,
          authUser.user.app_metadata,
        );
        if (invalidationWarning) {
          smsNotice = {
            status: "failed",
            detail: `${smsNotice.detail} ${invalidationWarning}`,
          };
        }
      }
    }
  }

  const emailNotice = emailNeeds
    ? await deliverAccountEmail({
        email: profile.email,
        fullName: fullStaffName([
          profile.first_name,
          profile.middle_name,
          profile.last_name,
        ]),
        employeeNumber: profile.employee_number,
        smsSent: smsNotice.status === "sent" || profile.sms_notice_status === "sent",
      })
    : {
        status: "sent" as const,
        detail: "Email was not retried.",
      };
  const { error: noticeError } = await admin
    .from("profiles")
    .update({
      ...(emailNeeds ? { email_notice_status: emailNotice.status } : {}),
      ...(smsNeeds ? { sms_notice_status: smsNotice.status } : {}),
    })
    .eq("id", profile.id);
  const warning = [
    noticeWarning(
      emailNeeds ? emailNotice : { status: "sent", detail: "Email was already sent." },
      smsNeeds ? smsNotice : { status: "sent", detail: "SMS was already sent." },
    ),
    noticeError ? "Delivery status could not be saved." : null,
  ]
    .filter(Boolean)
    .join(" ");

  revalidatePath("/dashboard/hr", "layout");
  if (warning) {
    return {
      error: null,
      success: null,
      warning: `The account was not duplicated. ${warning}`,
    };
  }
  return succeeded("Failed notices were sent. The account was not duplicated.");
}

export async function updateStaffEmail(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHr();

  const id = field(formData, "id");
  const email = field(formData, "email").toLowerCase();
  const validationError = validateStaffEmail(email);

  if (!uuidPattern.test(id)) {
    return failed("The selected staff account is invalid.");
  }
  if (validationError) {
    return failed(validationError);
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("id", id)
    .maybeSingle();

  if (profileLookupError) {
    return failed(`Could not load this staff account: ${profileLookupError.message}`);
  }
  if (!profile || (profile.role !== "employee" && profile.role !== "supervisor")) {
    return failed("The staff account was not found.");
  }

  const { data: authLookup, error: authLookupError } = await admin.auth.admin.getUserById(
    profile.id,
  );
  if (authLookupError || !authLookup.user || authLookup.user.id !== profile.id) {
    return failed("The authentication account linked to this profile was not found.");
  }

  const previousEmail = (authLookup.user.email ?? profile.email).toLowerCase();
  if (email === previousEmail && email === profile.email.toLowerCase() && !authLookup.user.new_email) {
    return succeeded("Email address is unchanged.");
  }

  const { data: duplicateProfiles, error: duplicateError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .neq("id", profile.id)
    .limit(1);

  if (duplicateError) {
    return failed(`Could not check existing accounts: ${duplicateError.message}`);
  }
  if (duplicateProfiles?.length) {
    return failed("An account with this email already exists.");
  }

  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
    email,
  });
  if (updateError || !updated.user || updated.user.id !== profile.id) {
    const message = updateError?.message ?? "Supabase did not return the updated account.";
    if (/already|registered|exists|duplicate/i.test(message)) {
      return failed("An account with this email already exists.");
    }
    return failed(`Could not update the authentication email: ${message}`);
  }

  const { data: confirmed, error: confirmError } = await admin.auth.admin.getUserById(profile.id);
  if (confirmError || !confirmed.user || confirmed.user.id !== profile.id) {
    return failed(
      "The authentication update could not be confirmed. Check this account in Supabase Auth before trying again.",
    );
  }

  const change = interpretStaffEmailChange({
    requestedEmail: email,
    previousEmail,
    appliedEmail: confirmed.user.email ?? null,
    pendingEmail: confirmed.user.new_email ?? null,
  });

  if (change.status === "unchanged") {
    return succeeded(change.message);
  }
  if (change.status === "pending") {
    return succeeded(change.message);
  }
  if (change.status === "not-applied") {
    return failed(change.message);
  }

  const { data: savedProfile, error: profileError } = await admin
    .from("profiles")
    .update({ email: change.email })
    .eq("id", profile.id)
    .in("role", ["employee", "supervisor"])
    .select("id, email")
    .maybeSingle();

  if (profileError || !savedProfile || savedProfile.email.toLowerCase() !== change.email) {
    const { error: rollbackError } = await admin.auth.admin.updateUserById(profile.id, {
      email: previousEmail,
    });
    if (rollbackError) {
      return failed(
        `Authentication now uses ${change.email}, but the profile still has ${profile.email}. Restore the profile email to ${change.email} before the next sign-in. Profile error: ${profileError?.message ?? "profile email was not saved"}.`,
      );
    }
    return failed(
      `The profile email could not be saved, so the authentication email was restored to ${previousEmail}.`,
    );
  }

  revalidatePath("/dashboard/hr", "layout");
  revalidatePath("/dashboard/supervisor");
  revalidatePath("/dashboard/employee");
  return succeeded(change.message);
}

export async function updateStaffProfile(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHr();

  const id = field(formData, "id");
  const firstName = field(formData, "first_name");
  const middleName = field(formData, "middle_name");
  const lastName = field(formData, "last_name");
  const phone = field(formData, "phone");

  if (!uuidPattern.test(id) || !firstName || !lastName) {
    return failed("Enter a valid first and last name.");
  }
  if (middleName.length > 80 || firstName.length > 80 || lastName.length > 80) {
    return failed("Names must be 80 characters or fewer.");
  }
  if (phone && !normalizePhone(phone)) {
    return failed("Enter a valid mobile number with 10 to 15 digits.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      phone: phone ? normalizePhone(phone) : null,
    })
    .eq("id", id)
    .in("role", ["employee", "supervisor"])
    .select("id")
    .maybeSingle();

  if (error) {
    return failed(`Could not update this profile: ${error.message}`);
  }
  if (!data) {
    return failed("The staff account was not found.");
  }

  revalidatePath("/dashboard/hr", "layout");
  revalidatePath("/dashboard/supervisor");
  revalidatePath("/dashboard/employee");
  return succeeded("Profile updated.");
}

export async function setStaffActive(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireHr();
  const id = field(formData, "id");
  const activeValue = field(formData, "active");

  if (!uuidPattern.test(id) || (activeValue !== "true" && activeValue !== "false")) {
    return failed("Invalid account activation request.");
  }
  if (id === actor.id) {
    return failed("You cannot deactivate your own HR account.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: activeValue === "true" })
    .eq("id", id)
    .in("role", ["employee", "supervisor"])
    .select("id")
    .maybeSingle();

  if (error) {
    return failed(`Could not update this account: ${error.message}`);
  }
  if (!data) {
    return failed("The staff account was not found.");
  }

  revalidatePath("/dashboard/hr", "layout");
  revalidatePath("/dashboard/supervisor");
  revalidatePath("/dashboard/employee");
  return succeeded(
    activeValue === "true" ? "Account activated." : "Account deactivated.",
  );
}

export async function saveAssignment(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHr();

  const employeeId = field(formData, "employee_id");
  const supervisorId = field(formData, "supervisor_id");
  const postId = field(formData, "post_id");
  const locationId = field(formData, "duty_location_id");
  const shiftId = field(formData, "duty_shift_id");
  const startDate = field(formData, "start_date");

  if (
    ![employeeId, supervisorId, postId, locationId, shiftId].every((id) =>
      uuidPattern.test(id),
    ) ||
    !isValidDate(startDate)
  ) {
    return failed("Choose an employee, supervisor, post, location, shift, and start date.");
  }

  function isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const parsedDate = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsedDate.valueOf()) &&
      parsedDate.toISOString().slice(0, 10) === value
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("personnel_assignments").upsert(
    {
      employee_id: employeeId,
      supervisor_id: supervisorId,
      post_id: postId,
      duty_location_id: locationId,
      duty_shift_id: shiftId,
      start_date: startDate,
    },
    { onConflict: "employee_id" },
  );

  if (error) {
    return failed(`Could not save the assignment: ${error.message}`);
  }

  revalidatePath("/dashboard/hr", "layout");
  revalidatePath("/dashboard/supervisor");
  revalidatePath("/dashboard/employee");
  return succeeded("Assignment saved.");
}

export type DutyActionState = ActionState & {
  configurationId: string | null;
};

const dutyInitialFields = {
  error: null,
  success: null,
  configurationId: null,
};

function optionalUuid(value: string): string | null {
  if (!value) {
    return null;
  }
  return uuidPattern.test(value) ? value : null;
}

export async function saveDutyConfiguration(
  _previousState: DutyActionState,
  formData: FormData,
): Promise<DutyActionState> {
  await requireHr();

  const configurationId = optionalUuid(field(formData, "configuration_id"));
  const postId = optionalUuid(field(formData, "post_id"));
  const locationId = optionalUuid(field(formData, "location_id"));
  const shiftId = optionalUuid(field(formData, "shift_id"));
  const postName = field(formData, "post_name");
  const postDescription = field(formData, "post_description");
  const locationName = field(formData, "location_name");
  const locationAddress = field(formData, "location_address");
  const shiftName = field(formData, "shift_name");
  const startTime = field(formData, "start_time");
  const endTime = field(formData, "end_time");
  const isActive = formData.get("is_active") === "on";
  const acknowledgeShared = formData.get("acknowledge_shared") === "on";

  if (
    (field(formData, "configuration_id") && !configurationId) ||
    (field(formData, "post_id") && !postId) ||
    (field(formData, "location_id") && !locationId) ||
    (field(formData, "shift_id") && !shiftId)
  ) {
    return { ...dutyInitialFields, error: "The selected duty records are invalid." };
  }

  const validationError = validateDutyConfigurationInput({
    postName,
    postDescription,
    locationName,
    locationAddress,
    shiftName,
    startTime,
    endTime,
    isActive,
  });
  if (validationError) {
    return { ...dutyInitialFields, error: validationError };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_duty_configuration", {
    configuration_id: configurationId,
    post_id: postId,
    post_name: postName,
    post_description: postDescription || null,
    location_id: locationId,
    location_name: locationName,
    location_address: locationAddress || null,
    shift_id: shiftId,
    shift_name: shiftName,
    shift_start: startTime,
    shift_end: endTime,
    is_active: isActive,
    acknowledge_shared: acknowledgeShared,
  });

  if (error || !data?.configuration_id) {
    return {
      ...dutyInitialFields,
      error: error?.message.replace(/^.*ERROR:\s*/, "") ?? "The duty configuration could not be saved.",
    };
  }

  revalidatePath("/dashboard/hr", "layout");
  revalidatePath("/dashboard/supervisor");
  revalidatePath("/dashboard/employee");
  return {
    error: null,
    success: "Duty configuration saved.",
    configurationId: data.configuration_id,
  };
}

export async function setDutyConfigurationActive(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireHr();

  const configurationId = optionalUuid(field(formData, "configuration_id"));
  const postId = optionalUuid(field(formData, "post_id"));
  const locationId = optionalUuid(field(formData, "location_id"));
  const shiftId = optionalUuid(field(formData, "shift_id"));
  const activeValue = field(formData, "active");

  if (
    !postId ||
    !locationId ||
    !shiftId ||
    (field(formData, "configuration_id") && !configurationId) ||
    (activeValue !== "true" && activeValue !== "false")
  ) {
    return failed("Invalid duty configuration status request.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_duty_bundle_active", {
    configuration_id: configurationId,
    post_id: postId,
    location_id: locationId,
    shift_id: shiftId,
    is_active: activeValue === "true",
    acknowledge_shared: formData.get("acknowledge_shared") === "true",
  });

  if (error) {
    return failed(error.message.replace(/^.*ERROR:\s*/, ""));
  }

  revalidatePath("/dashboard/hr", "layout");
  revalidatePath("/dashboard/supervisor");
  revalidatePath("/dashboard/employee");
  return succeeded(
    activeValue === "true"
      ? "Duty configuration activated."
      : "Duty configuration deactivated.",
  );
}

export const STAFF_INVITE_ROLES = ["employee", "supervisor"] as const;

export type StaffInviteRole = (typeof STAFF_INVITE_ROLES)[number];

export type StaffInviteInput = {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  role: string;
  phone: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isStaffInviteRole(role: string): role is StaffInviteRole {
  return STAFF_INVITE_ROLES.some((staffRole) => staffRole === role);
}

export function validateStaffInvite(input: StaffInviteInput): string | null {
  if (!input.firstName.trim() || !input.lastName.trim()) {
    return "Enter a first and last name.";
  }
  if (input.firstName.trim().length > 80 || input.lastName.trim().length > 80) {
    return "First and last name must be 80 characters or fewer.";
  }
  if (input.middleName.trim().length > 80) {
    return "Middle name must be 80 characters or fewer.";
  }
  if (!emailPattern.test(input.email.trim().toLowerCase())) {
    return "Enter a valid email address.";
  }
  if (!isStaffInviteRole(input.role)) {
    return "Choose Employee or Supervisor. HR accounts cannot be created here.";
  }
  if (!input.phone.trim()) {
    return "Enter a mobile number.";
  }
  return null;
}

export function validateStaffEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!emailPattern.test(normalized) || normalized.length > 320) {
    return "Enter a valid email address.";
  }
  return null;
}

export type StaffEmailChange =
  | { status: "unchanged"; message: string }
  | { status: "updated"; message: string; email: string }
  | { status: "pending"; message: string; pendingEmail: string; currentEmail: string }
  | { status: "not-applied"; message: string };

export function interpretStaffEmailChange(input: {
  requestedEmail: string;
  previousEmail: string;
  appliedEmail: string | null;
  pendingEmail: string | null;
}): StaffEmailChange {
  const requestedEmail = input.requestedEmail.trim().toLowerCase();
  const previousEmail = input.previousEmail.trim().toLowerCase();
  const appliedEmail = input.appliedEmail?.trim().toLowerCase() || null;
  const pendingEmail = input.pendingEmail?.trim().toLowerCase() || null;

  if (requestedEmail === previousEmail && appliedEmail === previousEmail && !pendingEmail) {
    return { status: "unchanged", message: "Email address is unchanged." };
  }
  if (pendingEmail === requestedEmail && appliedEmail !== requestedEmail) {
    return {
      status: "pending",
      pendingEmail: requestedEmail,
      currentEmail: appliedEmail || previousEmail,
      message: `Confirmation is required. ${appliedEmail || previousEmail} remains the sign-in email until ${requestedEmail} is verified. The profile email was not changed.`,
    };
  }
  if (appliedEmail === requestedEmail) {
    return {
      status: "updated",
      email: requestedEmail,
      message: `Email address updated to ${requestedEmail}. The user should sign in with this address. Existing sessions stay signed in until they expire.`,
    };
  }
  return {
    status: "not-applied",
    message: "Supabase did not apply the new email address. No profile change was saved.",
  };
}


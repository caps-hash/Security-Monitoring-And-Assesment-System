import type { StaffInviteRole } from "@/lib/personnel/staff-invite";

export const NOTICE_STATUSES = ["sent", "failed", "not_configured"] as const;

export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

export type NoticeResult = {
  status: NoticeStatus;
  detail: string;
};

type EnvSource = Record<string, string | undefined>;

export function normalizePhone(phone: string): string | null {
  const compact = phone.trim().replace(/[\s()-]/g, "");
  if (!/^\+?[0-9]{10,15}$/.test(compact)) {
    return null;
  }
  return compact;
}

export function toE164(phone: string): string {
  const compact = phone.trim().replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) {
    return compact;
  }
  if (compact.startsWith("09") && compact.length === 11) {
    return `+63${compact.slice(1)}`;
  }
  if (compact.startsWith("63") && compact.length === 12) {
    return `+${compact}`;
  }
  return `+${compact}`;
}

export function emailProviderConfigured(env: EnvSource = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

export function smsProviderName(
  env: EnvSource = process.env,
): "twilio" | "semaphore" | null {
  if (
    env.TWILIO_ACCOUNT_SID?.trim() &&
    env.TWILIO_AUTH_TOKEN?.trim() &&
    env.TWILIO_FROM?.trim()
  ) {
    return "twilio";
  }
  if (env.SEMAPHORE_API_KEY?.trim()) {
    return "semaphore";
  }
  return null;
}

export function missingEmailConfigurationDetail(): string {
  return "Email is not configured. Set server-only RESEND_API_KEY and EMAIL_FROM.";
}

export function missingSmsConfigurationDetail(): string {
  return "SMS is not configured. Set server-only TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM, or SEMAPHORE_API_KEY.";
}

export function fullStaffName(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim() ?? "").filter(Boolean).join(" ");
}

export function buildAccountEmail(input: {
  fullName: string;
  employeeNumber: string;
  smsSent: boolean;
}): { subject: string; text: string } {
  const greeting = input.fullName || "there";
  const smsLine = input.smsSent
    ? "Your temporary login instructions will be sent separately via SMS."
    : "Temporary login instructions were not sent by SMS. HR must retry that notice. This email does not contain a password.";

  return {
    subject: "Your GLOBAL GROUND FORCE Account Has Been Created",
    text: [
      `Hello ${greeting},`,
      "",
      "Your GLOBAL GROUND FORCE account has been successfully created by HR.",
      "",
      `Your Employee ID is ${input.employeeNumber}.`,
      "",
      smsLine,
      "",
      "Please keep your credentials confidential and change your temporary password after your first login if a temporary password is used.",
      "",
      "Regards,",
      "",
      "ANDREW SABENA BALINGASA JR.",
      "",
      "(Human Resources Department)",
    ].join("\n"),
  };
}

export function buildAccountSms(input: {
  employeeNumber: string;
  temporaryPassword: string;
}): string {
  return `SAMS: Your account has been created by HR. Employee ID: ${input.employeeNumber}. Temporary login credentials: ${input.temporaryPassword}. Change your password after your first login.`;
}

export function accountCreatedMessage(
  role: StaffInviteRole,
  email: string,
  employeeNumber: string,
): string {
  const roleLabel = role === "supervisor" ? "Supervisor" : "Employee";
  const assignment =
    role === "employee"
      ? " Assign a supervisor, post, location, shift, and start date from this page."
      : " This supervisor can be selected when assigning an employee.";
  return `${roleLabel} account created for ${email}. Employee ID: ${employeeNumber}.${assignment} The temporary password is not shown here.`;
}

export function noticeWarning(
  email: NoticeResult,
  sms: NoticeResult,
): string | null {
  const problems = [email, sms]
    .filter((notice) => notice.status !== "sent")
    .map((notice) => notice.detail);
  return problems.length ? problems.join(" ") : null;
}

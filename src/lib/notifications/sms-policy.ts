import { displayStatus, type WorkflowStatus } from "../assessment/schedule.ts";

export const SMS_NOTIFICATION_TYPES = [
  "account_setup",
  "evaluation_reminder_due_soon",
  "evaluation_reminder_due",
  "evaluation_reminder_overdue",
  "evaluation_submitted",
  "assessment_result",
  "final_decision",
  "sms_failure",
] as const;

export const SMS_DELIVERY_STATUSES = [
  "pending",
  "processing",
  "sent",
  "delivered",
  "failed",
  "rejected",
  "not_configured",
] as const;

export const MAX_SMS_ATTEMPTS = 3;
export const MAX_SMS_CHARS = 320;
export const MAX_REMINDER_INTERVAL_DAYS = 90;

export type SmsNotificationType = (typeof SMS_NOTIFICATION_TYPES)[number];
export type SmsDeliveryStatus = (typeof SMS_DELIVERY_STATUSES)[number];
export type SmsRole = "hr" | "supervisor" | "employee";
export type ReminderKind = "due_soon" | "due" | "overdue";

export type PlannedSms = {
  idempotencyKey: string;
  notificationType: SmsNotificationType;
  recipientUserId: string | null;
  recipientRole: SmsRole;
  recipientPhone: string | null;
  employeeId: string | null;
  relatedRecordId: string | null;
  message: string;
};

export type ProviderAttempt = {
  outcome: "sent" | "failed" | "rejected";
  providerMessageId: string | null;
  errorMessage: string | null;
  retryable: boolean;
};

const TYPE_LABELS: Record<SmsNotificationType, string> = {
  account_setup: "account setup",
  evaluation_reminder_due_soon: "due-soon reminder",
  evaluation_reminder_due: "due reminder",
  evaluation_reminder_overdue: "overdue reminder",
  evaluation_submitted: "evaluation submission",
  assessment_result: "assessment result",
  final_decision: "final decision",
  sms_failure: "SMS failure",
};

export function smsTypeLabel(type: SmsNotificationType): string {
  return TYPE_LABELS[type];
}

export function isSmsNotificationType(value: string): value is SmsNotificationType {
  return SMS_NOTIFICATION_TYPES.some((type) => type === value);
}

export function isSmsDeliveryStatus(value: string): value is SmsDeliveryStatus {
  return SMS_DELIVERY_STATUSES.some((status) => status === value);
}

export function philippineMobileE164(phone: string | null | undefined): string | null {
  const compact = phone?.trim().replace(/[\s()-]/g, "") ?? "";
  const digits = compact.startsWith("+") ? compact.slice(1) : compact;
  const normalized = digits.startsWith("0") ? `63${digits.slice(1)}` : digits;
  return /^639\d{9}$/.test(normalized) ? `+${normalized}` : null;
}

export function providerPhone(e164: string, provider: "twilio" | "semaphore"): string {
  return provider === "semaphore" ? e164.replace(/^\+/, "") : e164;
}

export function clipSmsText(value: string, max = 40): string {
  const clean = value.replace(/\s+/g, " ").replace(/[^\x20-\x7E]/g, "").trim();
  if (clean.length <= max) {
    return clean;
  }
  return `${clean.slice(0, max - 3)}...`;
}

export function limitSms(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length <= MAX_SMS_CHARS ? clean : `${clean.slice(0, MAX_SMS_CHARS - 3)}...`;
}

export function accountSetupIdempotencyKey(userId: string): string {
  return `account_setup:${userId}`;
}

export function accountSetupLogMessage(employeeNumber: string): string {
  return limitSms(
    `SAMS: Your account has been created by HR. Employee ID: ${clipSmsText(employeeNumber, 20)}. Temporary login instructions were sent by SMS and are not stored in this log.`,
  );
}

export function reminderWindowStart(today: string, intervalDays: number): string {
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
  const start = day - (day % intervalDays);
  return new Date(start * 86_400_000).toISOString().slice(0, 10);
}

export function validateReminderInterval(value: number | null): string | null {
  if (value == null || !Number.isInteger(value)) {
    return "Enter a whole-day reminder interval. No interval is assumed.";
  }
  if (value < 1 || value > MAX_REMINDER_INTERVAL_DAYS) {
    return `The reminder interval must be from 1 to ${MAX_REMINDER_INTERVAL_DAYS} days.`;
  }
  return null;
}

export function reminderKindFor(input: {
  workflowStatus: WorkflowStatus;
  dueDate: string;
  today: string;
  dueSoonDays: number | null;
}): ReminderKind | null {
  if (
    input.workflowStatus === "completed" ||
    input.workflowStatus === "submitted" ||
    input.workflowStatus === "under_review"
  ) {
    return null;
  }
  if (input.workflowStatus !== "scheduled" && input.workflowStatus !== "returned_for_correction") {
    return null;
  }
  const status = displayStatus({
    workflowStatus: "scheduled",
    dueDate: input.dueDate,
    today: input.today,
    dueSoonDays: input.dueSoonDays,
  });
  if (status === "Due Soon") {
    return "due_soon";
  }
  if (status === "Due") {
    return "due";
  }
  if (status === "Overdue") {
    return "overdue";
  }
  return null;
}

const REMINDER_TYPES: Record<ReminderKind, SmsNotificationType> = {
  due_soon: "evaluation_reminder_due_soon",
  due: "evaluation_reminder_due",
  overdue: "evaluation_reminder_overdue",
};

export function planReminderSms(input: {
  today: string;
  dueSoonDays: number | null;
  intervalDays: number | null;
  assessmentId: string;
  employeeId: string;
  employeeName: string;
  supervisorId: string | null;
  supervisorName: string;
  supervisorPhone: string | null;
  evaluationNumber: number;
  dueDate: string;
  workflowStatus: WorkflowStatus;
}): { skip: string | null; plan: PlannedSms | null } {
  if (input.intervalDays == null) {
    return { skip: "Reminder interval is not configured.", plan: null };
  }
  const invalid = validateReminderInterval(input.intervalDays);
  if (invalid) {
    return { skip: invalid, plan: null };
  }
  const kind = reminderKindFor(input);
  if (!kind || input.evaluationNumber < 1 || input.evaluationNumber > 3) {
    return { skip: "This evaluation does not need a reminder.", plan: null };
  }
  if (!input.supervisorId) {
    return { skip: "No current supervisor is assigned.", plan: null };
  }
  const employee = clipSmsText(input.employeeName);
  const supervisor = clipSmsText(input.supervisorName || "Supervisor");
  const number = input.evaluationNumber;
  const message =
    kind === "due_soon"
      ? `Hello ${supervisor}, reminder: Evaluation ${number} for ${employee} is approaching its due date. Please log in to SAMS to review and submit the evaluation.`
      : kind === "due"
        ? `Hello ${supervisor}, Evaluation ${number} for ${employee} is due. Please log in to SAMS and submit the evaluation.`
        : `Hello ${supervisor}, Evaluation ${number} for ${employee} is overdue. Please log in to SAMS and complete the required evaluation.`;
  return {
    skip: null,
    plan: {
      idempotencyKey: `reminder:${input.assessmentId}:${input.supervisorId}:${kind}:${reminderWindowStart(input.today, input.intervalDays)}`,
      notificationType: REMINDER_TYPES[kind],
      recipientUserId: input.supervisorId,
      recipientRole: "supervisor",
      recipientPhone: input.supervisorPhone,
      employeeId: input.employeeId,
      relatedRecordId: input.assessmentId,
      message: limitSms(message),
    },
  };
}

export function planSubmissionSms(input: {
  assessmentId: string;
  submittedAt: string;
  employeeId: string;
  employeeName: string;
  supervisorName: string;
  evaluationNumber: number;
  hr: { id: string; name: string; phone: string | null }[];
}): PlannedSms[] {
  const employee = clipSmsText(input.employeeName);
  const supervisor = clipSmsText(input.supervisorName);
  const message = limitSms(
    `New evaluation submission: ${supervisor} submitted Evaluation ${input.evaluationNumber} for ${employee}. Please log in to SAMS for review.`,
  );
  const recipients = input.hr.length
    ? input.hr
    : [{ id: "none", name: "HR", phone: null }];
  return recipients.map((person) => ({
    idempotencyKey: `evaluation_submitted:${input.assessmentId}:${input.submittedAt}:${person.id}`,
    notificationType: "evaluation_submitted",
    recipientUserId: person.id === "none" ? null : person.id,
    recipientRole: "hr",
    recipientPhone: person.phone,
    employeeId: input.employeeId,
    relatedRecordId: input.assessmentId,
    message: person.id === "none" ? limitSms(`${message} No active HR phone is available.`) : message,
  }));
}

export function planAssessmentResultSms(input: {
  assessmentId: string;
  releasedAt: string | null;
  employeeId: string;
  employeeName: string;
  employeePhone: string | null;
  supervisorId: string | null;
  supervisorName: string;
  supervisorPhone: string | null;
  evaluationNumber: number;
  score: number | null;
  rating: string | null;
}): PlannedSms[] {
  if (!input.releasedAt) {
    return [];
  }
  const employee = clipSmsText(input.employeeName);
  const score = Number.isFinite(input.score) ? input.score : null;
  const rating = input.rating?.trim() ? clipSmsText(input.rating, 40) : "";
  const detail = [rating ? `Rating: ${rating}` : "", score != null ? `Score: ${score}` : ""]
    .filter(Boolean)
    .join(". ");
  const employeeMessage = limitSms(
    `Hello ${employee}, your Evaluation ${input.evaluationNumber} result has been released. ${detail ? `${detail}. ` : ""}Please log in to SAMS to view your detailed feedback.`,
  );
  const plans: PlannedSms[] = [
    {
      idempotencyKey: `assessment_result:${input.assessmentId}:${input.employeeId}`,
      notificationType: "assessment_result",
      recipientUserId: input.employeeId,
      recipientRole: "employee",
      recipientPhone: input.employeePhone,
      employeeId: input.employeeId,
      relatedRecordId: input.assessmentId,
      message: employeeMessage,
    },
  ];
  if (input.supervisorId && input.supervisorId !== input.employeeId) {
    plans.push({
      idempotencyKey: `assessment_result:${input.assessmentId}:${input.supervisorId}`,
      notificationType: "assessment_result",
      recipientUserId: input.supervisorId,
      recipientRole: "supervisor",
      recipientPhone: input.supervisorPhone,
      employeeId: input.employeeId,
      relatedRecordId: input.assessmentId,
      message: limitSms(
        `Hello ${clipSmsText(input.supervisorName || "Supervisor")}, Evaluation ${input.evaluationNumber} for ${employee} has been released. Please log in to SAMS to view the result.`,
      ),
    });
  }
  return plans;
}

export function planFinalDecisionSms(input: {
  employeeId: string;
  releasedAt: string | null;
  decision: "passed" | "not_passed" | null;
  employeeName: string;
  employeePhone: string | null;
  supervisorId: string | null;
  supervisorName: string;
  supervisorPhone: string | null;
}): PlannedSms[] {
  if (!input.releasedAt || (input.decision !== "passed" && input.decision !== "not_passed")) {
    return [];
  }
  const label = input.decision === "passed" ? "PASSED" : "NOT PASSED";
  const employee = clipSmsText(input.employeeName);
  const plans: PlannedSms[] = [
    {
      idempotencyKey: `final_decision:${input.employeeId}:${input.employeeId}`,
      notificationType: "final_decision",
      recipientUserId: input.employeeId,
      recipientRole: "employee",
      recipientPhone: input.employeePhone,
      employeeId: input.employeeId,
      relatedRecordId: input.employeeId,
      message: limitSms(
        `Hello ${employee}, your final SAMS assessment decision has been released: ${label}. Please log in to SAMS for details.`,
      ),
    },
  ];
  if (input.supervisorId && input.supervisorId !== input.employeeId) {
    plans.push({
      idempotencyKey: `final_decision:${input.employeeId}:${input.supervisorId}`,
      notificationType: "final_decision",
      recipientUserId: input.supervisorId,
      recipientRole: "supervisor",
      recipientPhone: input.supervisorPhone,
      employeeId: input.employeeId,
      relatedRecordId: input.employeeId,
      message: limitSms(
        `Hello ${clipSmsText(input.supervisorName || "Supervisor")}, the final decision for ${employee} has been released: ${label}. Please log in to SAMS for details.`,
      ),
    });
  }
  return plans;
}

export function planFailureAlertSms(input: {
  failedId: string;
  failedType: SmsNotificationType;
  employeeName: string | null;
  hr: { id: string; phone: string | null }[];
}): PlannedSms[] {
  if (!shouldAlertHr(input.failedType, "failed") || !input.hr.length) {
    return [];
  }
  const who = input.employeeName ? ` for ${clipSmsText(input.employeeName)}` : "";
  const message = limitSms(
    `SAMS: An SMS notification failed (${smsTypeLabel(input.failedType)}${who}). Log in to SAMS and open SMS notifications. This failure alert is not repeated.`,
  );
  return input.hr.map((person) => ({
    idempotencyKey: `sms_failure:${input.failedId}:${person.id}`,
    notificationType: "sms_failure",
    recipientUserId: person.id,
    recipientRole: "hr",
    recipientPhone: person.phone,
    employeeId: null,
    relatedRecordId: input.failedId,
    message,
  }));
}

export function shouldAlertHr(type: SmsNotificationType, status: string): boolean {
  return type !== "sms_failure" && (status === "failed" || status === "rejected");
}

export function canRetrySms(input: {
  status: SmsDeliveryStatus;
  attemptCount: number;
  providerMessageId: string | null;
  retryable: boolean;
}): boolean {
  if (!input.retryable || input.providerMessageId) {
    return false;
  }
  if (input.attemptCount >= MAX_SMS_ATTEMPTS) {
    return false;
  }
  return input.status === "failed" || input.status === "rejected" || input.status === "not_configured";
}

export function webhookStatus(value: string): SmsDeliveryStatus | null {
  const status = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["queued", "accepted", "sending", "sent", "pending", "processing"].includes(status)) {
    return "sent";
  }
  if (["delivered", "success", "successful"].includes(status)) {
    return "delivered";
  }
  if (["undelivered", "failed", "error", "expired"].includes(status)) {
    return "failed";
  }
  if (["rejected", "invalid", "blocked"].includes(status)) {
    return "rejected";
  }
  return null;
}

export function canApplyDeliveryStatus(
  current: SmsDeliveryStatus,
  next: SmsDeliveryStatus,
): boolean {
  if (current === "delivered" && next !== "delivered") {
    return false;
  }
  if ((current === "sent" || current === "delivered") && next === "processing") {
    return false;
  }
  return true;
}

export function parseProviderPayload(
  provider: "twilio" | "semaphore",
  httpStatus: number,
  bodyText: string,
): ProviderAttempt {
  const body = safeProviderText(bodyText);
  const parsed = parseJson(bodyText);
  const providerMessageId = readMessageId(provider, parsed);
  const providerError = readProviderError(parsed) || body;
  if (httpStatus >= 200 && httpStatus < 300) {
    return {
      outcome: "sent",
      providerMessageId,
      errorMessage: null,
      retryable: false,
    };
  }
  const rejected = isRejected(httpStatus, providerError);
  return {
    outcome: rejected ? "rejected" : "failed",
    providerMessageId: null,
    errorMessage: providerError || `SMS provider status ${httpStatus}.`,
    retryable: !providerMessageId,
  };
}

function isRejected(httpStatus: number, errorText: string): boolean {
  const lower = errorText.toLowerCase();
  return (
    httpStatus === 401 ||
    httpStatus === 403 ||
    httpStatus === 402 ||
    /credit|insufficient|balance|invalid number|not a valid phone|authenticate/.test(lower)
  );
}

function readMessageId(
  provider: "twilio" | "semaphore",
  parsed: unknown,
): string | null {
  const record = firstRecord(parsed);
  if (!record) {
    return null;
  }
  const value = provider === "twilio" ? record.sid : record.message_id ?? record.messageId;
  return value == null || value === "" ? null : String(value).slice(0, 120);
}

function readProviderError(parsed: unknown): string {
  const record = firstRecord(parsed);
  if (!record) {
    return "";
  }
  const value = record.message ?? record.error_message ?? record.error ?? record.detail;
  return typeof value === "string" ? safeProviderText(value) : "";
}

function firstRecord(parsed: unknown): Record<string, unknown> | null {
  if (Array.isArray(parsed)) {
    return firstRecord(parsed[0]);
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  return parsed as Record<string, unknown>;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function safeProviderText(value: string): string {
  return value
    .replace(/apikey=[^&\s]+/gi, "apikey=redacted")
    .replace(/authorization:\s*\S+/gi, "authorization: redacted")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function secretsMatch(provided: string, expected: string): boolean {
  if (!provided || !expected || provided.length !== expected.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < provided.length; index += 1) {
    mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

import "server-only";

import { sendConfiguredSms } from "@/lib/notifications/deliver";
import { buildAccountSms } from "@/lib/personnel/account-notices";
import {
  accountSetupIdempotencyKey,
  accountSetupLogMessage,
  canRetrySms,
  isSmsDeliveryStatus,
  isSmsNotificationType,
  philippineMobileE164,
  planAssessmentResultSms,
  planFailureAlertSms,
  planFinalDecisionSms,
  planReminderSms,
  planSubmissionSms,
  shouldAlertHr,
  smsTypeLabel,
  type PlannedSms,
  type SmsDeliveryStatus,
  type SmsNotificationType,
} from "@/lib/notifications/sms-policy";
import type { NoticeResult } from "@/lib/personnel/account-notices";
import { smsProviderName } from "@/lib/personnel/account-notices";
import { manilaDateKey } from "@/lib/attendance/policy";
import type { WorkflowStatus } from "@/lib/assessment/schedule";
import { recordAudit } from "@/lib/security/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type SmsRow = {
  id: string;
  idempotency_key: string;
  delivery_status: string;
  attempt_count: number;
  provider_message_id: string | null;
  retryable: boolean;
  notification_type: string;
  message_content: string;
  recipient_phone: string | null;
  recipient_user_id: string | null;
  recipient_role: "hr" | "supervisor" | "employee";
  employee_id: string | null;
  related_record_id: string | null;
};

type ProfileRow = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  employee_number: string | null;
};

const profileColumns = "id, first_name, middle_name, last_name, phone, role, is_active, employee_number";

export async function accountSetupAlreadySent(userId: string): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("sms_notifications")
      .select("delivery_status, provider_message_id")
      .eq("idempotency_key", accountSetupIdempotencyKey(userId))
      .maybeSingle();
    if (error || !data) {
      return false;
    }
    return data.delivery_status === "sent" || data.delivery_status === "delivered" || Boolean(data.provider_message_id);
  } catch {
    return false;
  }
}

export async function sendAccountSetupSms(input: {
  userId: string;
  phone: string;
  employeeNumber: string;
  temporaryPassword: string;
  role: "employee" | "supervisor";
  retry: boolean;
}): Promise<NoticeResult> {
  const plan: PlannedSms = {
    idempotencyKey: accountSetupIdempotencyKey(input.userId),
    notificationType: "account_setup",
    recipientUserId: input.userId,
    recipientRole: input.role,
    recipientPhone: input.phone,
    employeeId: input.userId,
    relatedRecordId: input.userId,
    message: accountSetupLogMessage(input.employeeNumber),
  };
  if (!smsProviderName()) {
    await recordWithoutSend(plan, "not_configured", "SMS is not configured.");
    return { status: "not_configured", detail: "SMS is not configured." };
  }
  if (!philippineMobileE164(input.phone)) {
    await recordWithoutSend(plan, "rejected", "The mobile number is not a valid Philippine mobile number.");
    return { status: "failed", detail: "The mobile number is not a valid Philippine mobile number." };
  }
  const claimed = await claimPlan(plan, input.retry);
  if (!claimed.proceed) {
    return claimed.alreadyAccepted
      ? { status: "sent", detail: "Account setup SMS was already accepted. It was not sent again." }
      : { status: "failed", detail: claimed.detail };
  }
  const sent = await sendConfiguredSms({
    phone: input.phone,
    body: buildAccountSms({
      employeeNumber: input.employeeNumber,
      temporaryPassword: input.temporaryPassword,
    }),
  });
  const status = sent.status === "sent" ? "sent" : sent.status === "rejected" ? "rejected" : "failed";
  await finishClaim(claimed, status, sent.errorMessage, sent.providerMessageId, sent.retryable, sent.provider);
  if ((status === "failed" || status === "rejected") && claimed.rowId) {
    await alertFailure(claimed.rowId, "account_setup", input.userId);
  }
  if (status === "sent") {
    return { status: "sent", detail: "SMS accepted by the provider. Delivery is not confirmed until a callback." };
  }
  return { status: "failed", detail: sent.errorMessage || "SMS delivery failed." };
}

export async function notifyEvaluationSubmitted(assessmentId: string, supervisorName: string): Promise<string> {
  return notifyPlans(async (admin) => {
    const assessment = await loadAssessment(admin, assessmentId);
    if (!assessment || assessment.workflow_status !== "submitted") {
      return [];
    }
    const form = await admin
      .from("evaluation_forms")
      .select("submitted_at")
      .eq("assessment_id", assessmentId)
      .maybeSingle();
    if (form.error || !form.data?.submitted_at) {
      return [];
    }
    const employee = await loadProfile(admin, assessment.employee_id);
    const hr = await loadActiveHr(admin);
    return planSubmissionSms({
      assessmentId,
      submittedAt: form.data.submitted_at,
      employeeId: assessment.employee_id,
      employeeName: personName(employee),
      supervisorName,
      evaluationNumber: assessment.evaluation_number,
      hr: hr.map((person) => ({ id: person.id, name: personName(person), phone: person.phone })),
    });
  });
}

export async function notifyReleasedEvaluation(assessmentId: string): Promise<string> {
  return notifyPlans(async (admin) => {
    const assessment = await loadAssessment(admin, assessmentId);
    const result = await admin
      .from("evaluation_results")
      .select("official_score, calculated_rating, released_at")
      .eq("assessment_id", assessmentId)
      .maybeSingle();
    if (!assessment || result.error || !result.data?.released_at) {
      return [];
    }
    const employee = await loadProfile(admin, assessment.employee_id);
    const supervisor = await loadAssignedSupervisor(admin, assessment.employee_id);
    return planAssessmentResultSms({
      assessmentId,
      releasedAt: result.data.released_at,
      employeeId: assessment.employee_id,
      employeeName: personName(employee),
      employeePhone: employee?.phone ?? null,
      supervisorId: supervisor?.id ?? null,
      supervisorName: personName(supervisor),
      supervisorPhone: supervisor?.phone ?? null,
      evaluationNumber: assessment.evaluation_number,
      score: result.data.official_score,
      rating: result.data.calculated_rating,
    });
  });
}

export async function notifyReleasedFinalDecision(employeeId: string): Promise<string> {
  return notifyPlans(async (admin) => {
    const decision = await admin
      .from("final_decisions")
      .select("decision, released_at")
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (decision.error || !decision.data?.released_at) {
      return [];
    }
    if (decision.data.decision !== "passed" && decision.data.decision !== "not_passed") {
      return [];
    }
    const employee = await loadProfile(admin, employeeId);
    const supervisor = await loadAssignedSupervisor(admin, employeeId);
    return planFinalDecisionSms({
      employeeId,
      releasedAt: decision.data.released_at,
      decision: decision.data.decision,
      employeeName: personName(employee),
      employeePhone: employee?.phone ?? null,
      supervisorId: supervisor?.id ?? null,
      supervisorName: personName(supervisor),
      supervisorPhone: supervisor?.phone ?? null,
    });
  });
}

export async function runEvaluationReminders(now = new Date()): Promise<{
  sent: number;
  skipped: number;
  detail: string;
}> {
  let admin: AdminClient;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { sent: 0, skipped: 0, detail: "SMS reminders need SUPABASE_SERVICE_ROLE_KEY on the server." };
  }
  const settings = await admin
    .from("sms_settings")
    .select("reminder_interval_days")
    .eq("id", 1)
    .maybeSingle();
  if (settings.error) {
    return { sent: 0, skipped: 0, detail: "SMS settings are unavailable until the Phase 7 migration is applied." };
  }
  const interval = settings.data?.reminder_interval_days ?? null;
  if (interval == null) {
    return { sent: 0, skipped: 0, detail: "Reminder interval is not configured. No reminder was sent." };
  }
  const assessmentSettings = await admin
    .from("assessment_settings")
    .select("due_soon_days")
    .eq("id", 1)
    .maybeSingle();
  const dueSoonDays = assessmentSettings.data?.due_soon_days ?? null;
  const assessments = await admin
    .from("assessments")
    .select("id, employee_id, evaluation_number, due_date, workflow_status")
    .in("workflow_status", ["scheduled", "returned_for_correction"]);
  if (assessments.error) {
    return { sent: 0, skipped: 0, detail: assessments.error.message };
  }
  const today = manilaDateKey(now);
  let sent = 0;
  let skipped = 0;
  for (const assessment of assessments.data ?? []) {
    const employee = await loadProfile(admin, assessment.employee_id);
    const supervisor = await loadAssignedSupervisor(admin, assessment.employee_id);
    const planned = planReminderSms({
      today,
      dueSoonDays,
      intervalDays: interval,
      assessmentId: assessment.id,
      employeeId: assessment.employee_id,
      employeeName: personName(employee),
      supervisorId: supervisor?.id ?? null,
      supervisorName: personName(supervisor),
      supervisorPhone: supervisor?.phone ?? null,
      evaluationNumber: assessment.evaluation_number,
      dueDate: assessment.due_date,
      workflowStatus: assessment.workflow_status as WorkflowStatus,
    });
    if (!planned.plan) {
      skipped += 1;
      continue;
    }
    const result = await dispatchPlan(admin, planned.plan, false);
    if (result === "sent" || result === "failed" || result === "rejected" || result === "not_configured") {
      sent += result === "sent" ? 1 : 0;
      skipped += result === "sent" ? 0 : 1;
    } else {
      skipped += 1;
    }
  }
  return {
    sent,
    skipped,
    detail: `Reminder check finished. Accepted ${sent} new reminder SMS. Skipped ${skipped}. Provider acceptance is not confirmed delivery.`,
  };
}

export async function retrySmsNotification(id: string): Promise<{ error: string | null; success: string | null }> {
  let admin: AdminClient;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { error: "SMS retry needs SUPABASE_SERVICE_ROLE_KEY on the server.", success: null };
  }
  const loaded = await admin
    .from("sms_notifications")
    .select("id, idempotency_key, delivery_status, attempt_count, provider_message_id, retryable, notification_type, message_content, recipient_phone, recipient_user_id, recipient_role, employee_id, related_record_id")
    .eq("id", id)
    .maybeSingle();
  if (loaded.error || !loaded.data) {
    return { error: loaded.error?.message ?? "The SMS notification was not found.", success: null };
  }
  const row = loaded.data as SmsRow;
  if (!isSmsDeliveryStatus(row.delivery_status) || !isSmsNotificationType(row.notification_type)) {
    return { error: "This SMS notification cannot be retried.", success: null };
  }
  if (
    !canRetrySms({
      status: row.delivery_status,
      attemptCount: row.attempt_count,
      providerMessageId: row.provider_message_id,
      retryable: row.retryable,
    })
  ) {
    return { error: "This SMS was already accepted or is not eligible for retry.", success: null };
  }
  if (row.notification_type === "account_setup") {
    return {
      error: "Retry account setup from Personnel so a new temporary password can be issued. This log does not store that password.",
      success: null,
    };
  }
  const currentPhone = row.recipient_user_id
    ? (await loadProfile(admin, row.recipient_user_id))?.phone ?? row.recipient_phone
    : row.recipient_phone;
  const plan: PlannedSms = {
    idempotencyKey: row.idempotency_key,
    notificationType: row.notification_type,
    recipientUserId: row.recipient_user_id,
    recipientRole: row.recipient_role,
    recipientPhone: currentPhone,
    employeeId: row.employee_id,
    relatedRecordId: row.related_record_id,
    message: row.message_content,
  };
  const result = await dispatchPlan(admin, plan, true);
  if (result === "sent") {
    return { error: null, success: "The SMS was accepted again by the provider. Delivery is not confirmed yet." };
  }
  return { error: `Retry finished with status ${result}.`, success: null };
}

export async function applyProviderDeliveryUpdate(input: {
  providerMessageId: string;
  status: SmsDeliveryStatus;
  provider: string | null;
}): Promise<{ updated: boolean }> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("sms_notifications")
    .select("id, delivery_status")
    .eq("provider_message_id", input.providerMessageId);
  if (input.provider) {
    query = query.eq("provider", input.provider);
  }
  const existing = await query.maybeSingle();
  if (existing.error || !existing.data || !isSmsDeliveryStatus(existing.data.delivery_status)) {
    return { updated: false };
  }
  if (existing.data.delivery_status === "delivered" && input.status !== "delivered") {
    return { updated: false };
  }
  const { error } = await admin
    .from("sms_notifications")
    .update({
      delivery_status: input.status,
      delivered_at: input.status === "delivered" ? new Date().toISOString() : null,
      error_message: input.status === "failed" || input.status === "rejected" ? "Provider callback reported a failure." : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.data.id);
  if (!error) {
    await recordAudit({
      actorId: null,
      actionType: "sms.delivery_updated",
      recordType: "sms",
      recordId: existing.data.id,
      summary: "SMS provider delivery status was updated.",
      changes: { status: input.status, provider: input.provider ?? "" },
      idempotencyKey: `sms-callback:${existing.data.id}:${input.status}`,
    });
  }
  return { updated: !error };
}

async function notifyPlans(load: (admin: AdminClient) => Promise<PlannedSms[]>): Promise<string> {
  try {
    const admin = createSupabaseAdminClient();
    const plans = await load(admin);
    if (!plans.length) {
      return "No SMS was sent.";
    }
    const results: string[] = [];
    for (const plan of plans) {
      results.push(`${smsTypeLabel(plan.notificationType)}: ${await dispatchPlan(admin, plan, false)}`);
    }
    return `SMS ${results.join("; ")}. Provider acceptance is not confirmed delivery.`;
  } catch {
    return "SMS could not be recorded.";
  }
}

async function dispatchPlan(
  admin: AdminClient,
  plan: PlannedSms,
  retry: boolean,
): Promise<SmsDeliveryStatus | "skipped"> {
  const phone = philippineMobileE164(plan.recipientPhone);
  if (!phone) {
    await recordWithoutSend(
      plan,
      plan.recipientPhone ? "rejected" : "failed",
      plan.recipientPhone
        ? "The mobile number is not a valid Philippine mobile number."
        : "The recipient has no mobile number.",
    );
    return plan.recipientPhone ? "rejected" : "failed";
  }
  if (!smsProviderName()) {
    await recordWithoutSend(plan, "not_configured", "SMS is not configured.");
    return "not_configured";
  }
  const claimed = await claimPlan(plan, retry, admin);
  if (!claimed.proceed || !claimed.rowId) {
    return "skipped";
  }
  const sent = await sendConfiguredSms({ phone, body: plan.message });
  const status: SmsDeliveryStatus =
    sent.status === "invalid_phone" ? "rejected" : sent.status === "not_configured" ? "not_configured" : sent.status;
  await finishClaim(
    claimed,
    status,
    sent.errorMessage,
    sent.providerMessageId,
    sent.retryable,
    sent.provider,
    admin,
  );
  if (shouldAlertHr(plan.notificationType, status) && status !== "not_configured") {
    await alertFailure(claimed.rowId, plan.notificationType, plan.employeeId, admin);
  }
  return status;
}

async function recordWithoutSend(
  plan: PlannedSms,
  status: Extract<SmsDeliveryStatus, "failed" | "rejected" | "not_configured">,
  errorMessage: string,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("sms_notifications").insert({
      idempotency_key: plan.idempotencyKey,
      recipient_phone: plan.recipientPhone,
      recipient_user_id: plan.recipientUserId,
      employee_id: plan.employeeId,
      recipient_role: plan.recipientRole,
      notification_type: plan.notificationType,
      related_record_id: plan.relatedRecordId,
      message_content: plan.message,
      delivery_status: status,
      error_message: errorMessage.slice(0, 180),
      attempt_count: status === "not_configured" ? 0 : 1,
      retryable: status !== "rejected" || !plan.recipientPhone,
    });
    if (!error) {
      await recordAudit({
        actorId: null,
        actionType: "sms.recorded",
        recordType: "sms",
        recordId: plan.relatedRecordId,
        summary: "SMS was recorded without provider acceptance.",
        changes: { status, notificationType: plan.notificationType },
        idempotencyKey: `sms-record:${plan.idempotencyKey}:${status}`,
      });
    }
    if (error && error.code !== "23505" && shouldAlertHr(plan.notificationType, status)) {
      return;
    }
    if (!error && shouldAlertHr(plan.notificationType, status)) {
      const inserted = await admin
        .from("sms_notifications")
        .select("id")
        .eq("idempotency_key", plan.idempotencyKey)
        .maybeSingle();
      if (inserted.data?.id) {
        await alertFailure(inserted.data.id, plan.notificationType, plan.employeeId, admin);
      }
    }
  } catch {
    return;
  }
}

async function claimPlan(
  plan: PlannedSms,
  retry: boolean,
  admin = safeAdmin(),
): Promise<{ proceed: boolean; rowId: string | null; detail: string; alreadyAccepted: boolean }> {
  if (!admin) {
    return { proceed: true, rowId: null, detail: "SMS log is unavailable.", alreadyAccepted: false };
  }
  if (retry) {
    const existing = await admin
      .from("sms_notifications")
      .select("id, delivery_status, attempt_count, provider_message_id, retryable")
      .eq("idempotency_key", plan.idempotencyKey)
      .maybeSingle();
    if (existing.error || !existing.data || !isSmsDeliveryStatus(existing.data.delivery_status)) {
      return { proceed: false, rowId: null, detail: "The SMS log row could not be claimed.", alreadyAccepted: false };
    }
    if (
      !canRetrySms({
        status: existing.data.delivery_status,
        attemptCount: existing.data.attempt_count,
        providerMessageId: existing.data.provider_message_id,
        retryable: existing.data.retryable,
      })
    ) {
      return {
        proceed: false,
        rowId: existing.data.id,
        detail: "Already recorded.",
        alreadyAccepted: existing.data.delivery_status === "sent" || existing.data.delivery_status === "delivered",
      };
    }
    const { data, error } = await admin
      .from("sms_notifications")
      .update({
        delivery_status: "processing",
        attempt_count: existing.data.attempt_count + 1,
        retryable: false,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id)
      .eq("attempt_count", existing.data.attempt_count)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return { proceed: false, rowId: null, detail: "Another retry is already in progress.", alreadyAccepted: false };
    }
    return { proceed: true, rowId: data.id, detail: "", alreadyAccepted: false };
  }

  const { data, error } = await admin
    .from("sms_notifications")
    .insert({
      idempotency_key: plan.idempotencyKey,
      recipient_phone: plan.recipientPhone,
      recipient_user_id: plan.recipientUserId,
      employee_id: plan.employeeId,
      recipient_role: plan.recipientRole,
      notification_type: plan.notificationType,
      related_record_id: plan.relatedRecordId,
      message_content: plan.message,
      delivery_status: "processing",
      attempt_count: 1,
      retryable: false,
    })
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") {
    const existing = await admin
      .from("sms_notifications")
      .select("delivery_status, provider_message_id")
      .eq("idempotency_key", plan.idempotencyKey)
      .maybeSingle();
    return {
      proceed: false,
      rowId: null,
      detail: "This SMS was already recorded.",
      alreadyAccepted:
        existing.data?.delivery_status === "sent" ||
        existing.data?.delivery_status === "delivered" ||
        Boolean(existing.data?.provider_message_id),
    };
  }
  if (error || !data) {
    return { proceed: true, rowId: null, detail: error?.message ?? "SMS log insert failed.", alreadyAccepted: false };
  }
  return { proceed: true, rowId: data.id, detail: "", alreadyAccepted: false };
}

async function finishClaim(
  claimed: { rowId: string | null },
  status: SmsDeliveryStatus,
  errorMessage: string | null,
  providerMessageId: string | null,
  retryable: boolean,
  provider: string | null = smsProviderName(),
  admin = safeAdmin(),
): Promise<void> {
  if (!admin || !claimed.rowId) {
    return;
  }
  await admin
    .from("sms_notifications")
    .update({
      delivery_status: status,
      provider,
      provider_message_id: providerMessageId,
      error_message: errorMessage ? errorMessage.slice(0, 180) : null,
      retryable: retryable && !providerMessageId && status !== "sent" && status !== "delivered",
      provider_response: { status, providerMessageId },
      sent_at: status === "sent" || status === "delivered" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimed.rowId);
  await recordAudit({
    actorId: null,
    actionType: "sms.delivery_recorded",
    recordType: "sms",
    recordId: claimed.rowId,
    summary: "SMS provider response was recorded.",
    changes: { status, provider: provider ?? "" },
    idempotencyKey: `sms-finish:${claimed.rowId}:${status}`,
  });
}

async function alertFailure(
  failedId: string,
  failedType: SmsNotificationType,
  employeeId: string | null,
  admin = safeAdmin(),
): Promise<void> {
  if (!admin || !shouldAlertHr(failedType, "failed")) {
    return;
  }
  const employeeName = employeeId ? personName(await loadProfile(admin, employeeId)) : null;
  const hr = await loadActiveHr(admin);
  const plans = planFailureAlertSms({
    failedId,
    failedType,
    employeeName,
    hr: hr.map((person) => ({ id: person.id, phone: person.phone })),
  });
  for (const plan of plans) {
    await dispatchPlan(admin, plan, false);
  }
}

function safeAdmin(): AdminClient | null {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

async function loadAssessment(admin: AdminClient, assessmentId: string) {
  const { data, error } = await admin
    .from("assessments")
    .select("id, employee_id, evaluation_number, workflow_status")
    .eq("id", assessmentId)
    .maybeSingle();
  return error ? null : data;
}

async function loadProfile(admin: AdminClient, id: string): Promise<ProfileRow | null> {
  const { data, error } = await admin.from("profiles").select(profileColumns).eq("id", id).maybeSingle();
  return error ? null : data;
}

async function loadAssignedSupervisor(admin: AdminClient, employeeId: string): Promise<ProfileRow | null> {
  const assignment = await admin
    .from("personnel_assignments")
    .select("supervisor_id")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (assignment.error || !assignment.data) {
    return null;
  }
  const supervisor = await loadProfile(admin, assignment.data.supervisor_id);
  return supervisor?.is_active ? supervisor : null;
}

async function loadActiveHr(admin: AdminClient): Promise<ProfileRow[]> {
  const { data, error } = await admin
    .from("profiles")
    .select(profileColumns)
    .eq("role", "hr")
    .eq("is_active", true);
  return error ? [] : data ?? [];
}

function personName(profile: ProfileRow | null): string {
  if (!profile) {
    return "Personnel";
  }
  return [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ");
}

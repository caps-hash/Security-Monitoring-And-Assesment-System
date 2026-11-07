"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/profile";
import { retrySmsNotification, runEvaluationReminders } from "@/lib/notifications/sms-dispatch";
import { validateReminderInterval } from "@/lib/notifications/sms-policy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SmsActionState = { error: string | null; success: string | null };

export async function saveSmsReminderInterval(
  _previous: SmsActionState,
  formData: FormData,
): Promise<SmsActionState> {
  const profile = await requireRole("hr");
  const interval = Number(String(formData.get("reminderIntervalDays") ?? ""));
  const invalid = validateReminderInterval(Number.isFinite(interval) ? interval : null);
  if (invalid) {
    return { error: invalid, success: null };
  }
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("sms_settings").upsert({
      id: 1,
      reminder_interval_days: interval,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return { error: "SMS settings are unavailable until the Phase 7 migration is applied.", success: null };
    }
  } catch {
    return { error: "SMS settings need SUPABASE_SERVICE_ROLE_KEY on the server.", success: null };
  }
  revalidatePath("/dashboard/hr/sms");
  return { error: null, success: "Reminder interval saved. No reminder is sent until the scheduled check runs." };
}

export async function runSmsReminderCheck(
  previous: SmsActionState,
): Promise<SmsActionState> {
  void previous;
  await requireRole("hr");
  const result = await runEvaluationReminders();
  revalidatePath("/dashboard/hr/sms");
  return { error: null, success: result.detail };
}

export async function retryLoggedSms(
  _previous: SmsActionState,
  formData: FormData,
): Promise<SmsActionState> {
  await requireRole("hr");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { error: "Choose a logged SMS notification.", success: null };
  }
  const result = await retrySmsNotification(id);
  revalidatePath("/dashboard/hr/sms");
  return result;
}

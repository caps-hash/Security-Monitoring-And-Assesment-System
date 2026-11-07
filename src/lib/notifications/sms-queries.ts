import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isSmsDeliveryStatus,
  isSmsNotificationType,
  type SmsDeliveryStatus,
  type SmsNotificationType,
} from "@/lib/notifications/sms-policy";

export type SmsLogRow = {
  id: string;
  recipientPhone: string | null;
  recipientName: string;
  employeeName: string;
  employeeNumber: string | null;
  notificationType: SmsNotificationType;
  deliveryStatus: SmsDeliveryStatus;
  provider: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  attemptCount: number;
  retryable: boolean;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
};

export type SmsLogFilters = {
  q: string;
  type: string;
  status: string;
  from: string;
  to: string;
};

export type SmsLogView = {
  ready: boolean;
  message: string | null;
  rows: SmsLogRow[];
  reminderIntervalDays: number | null;
  filters: SmsLogFilters;
};

export function readSmsFilters(
  params: Record<string, string | string[] | undefined>,
): SmsLogFilters {
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  return {
    q: first(params.q).slice(0, 80),
    type: first(params.type),
    status: first(params.status),
    from: /^\d{4}-\d{2}-\d{2}$/.test(first(params.from)) ? first(params.from) : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(first(params.to)) ? first(params.to) : "",
  };
}

export async function loadSmsLog(filters: SmsLogFilters): Promise<SmsLogView> {
  try {
    const admin = createSupabaseAdminClient();
    const settings = await admin
      .from("sms_settings")
      .select("reminder_interval_days")
      .eq("id", 1)
      .maybeSingle();
    let query = admin
      .from("sms_notifications")
      .select("id, recipient_phone, recipient_user_id, employee_id, notification_type, delivery_status, provider, provider_message_id, error_message, attempt_count, retryable, created_at, sent_at, delivered_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (isSmsNotificationType(filters.type)) {
      query = query.eq("notification_type", filters.type);
    }
    if (isSmsDeliveryStatus(filters.status)) {
      query = query.eq("delivery_status", filters.status);
    }
    if (filters.from) {
      query = query.gte("created_at", `${filters.from}T00:00:00+08:00`);
    }
    if (filters.to) {
      query = query.lte("created_at", `${filters.to}T23:59:59+08:00`);
    }
    const [logs, profiles] = await Promise.all([
      query,
      admin.from("profiles").select("id, first_name, middle_name, last_name, employee_number"),
    ]);
    if (logs.error || profiles.error || settings.error) {
      return empty(filters, "SMS logs are unavailable until the Phase 7 migration is applied.");
    }
    const people = new Map(
      (profiles.data ?? []).map((person) => [
        person.id,
        {
          name: [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" "),
          employeeNumber: person.employee_number,
        },
      ]),
    );
    const needle = filters.q.toLowerCase();
    const rows = (logs.data ?? []).flatMap((row) => {
      if (!isSmsNotificationType(row.notification_type) || !isSmsDeliveryStatus(row.delivery_status)) {
        return [];
      }
      const employee = row.employee_id ? people.get(row.employee_id) : undefined;
      const recipient = row.recipient_user_id ? people.get(row.recipient_user_id) : undefined;
      const employeeName = employee?.name || "Not linked";
      const recipientName = recipient?.name || "Not linked";
      const haystack = `${employeeName} ${employee?.employeeNumber ?? ""} ${recipientName} ${row.recipient_phone ?? ""}`.toLowerCase();
      if (needle && !haystack.includes(needle)) {
        return [];
      }
      return [{
        id: row.id,
        recipientPhone: row.recipient_phone,
        recipientName,
        employeeName,
        employeeNumber: employee?.employeeNumber ?? null,
        notificationType: row.notification_type,
        deliveryStatus: row.delivery_status,
        provider: row.provider,
        providerMessageId: row.provider_message_id,
        errorMessage: row.error_message,
        attemptCount: row.attempt_count,
        retryable: row.retryable,
        createdAt: row.created_at,
        sentAt: row.sent_at,
        deliveredAt: row.delivered_at,
      }];
    });
    return {
      ready: true,
      message: rows.length === 100 ? "Showing the latest 100 matching notifications." : null,
      rows,
      reminderIntervalDays: settings.data?.reminder_interval_days ?? null,
      filters,
    };
  } catch {
    return empty(filters, "SMS logs need SUPABASE_SERVICE_ROLE_KEY on the server.");
  }
}

function empty(filters: SmsLogFilters, message: string): SmsLogView {
  return { ready: false, message, rows: [], reminderIntervalDays: null, filters };
}

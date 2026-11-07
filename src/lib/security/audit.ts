import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeAuditChanges } from "@/lib/security/access";

export type AuditEvent = {
  actorId: string | null;
  actionType: string;
  recordType: string;
  recordId?: string | null;
  summary: string;
  changes?: Record<string, unknown>;
  idempotencyKey?: string | null;
};

export async function recordAudit(event: AuditEvent): Promise<void> {
  const actionType = event.actionType.trim().slice(0, 80);
  const recordType = event.recordType.trim().slice(0, 40);
  const summary = event.summary.trim().slice(0, 500);
  if (!actionType || !recordType || !summary) {
    return;
  }
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      actor_id: event.actorId,
      action_type: actionType,
      record_type: recordType,
      record_id: event.recordId?.slice(0, 80) ?? null,
      summary,
      changes: sanitizeAuditChanges(event.changes ?? {}),
      idempotency_key: event.idempotencyKey?.slice(0, 160) ?? null,
    });
    if (error && error.code !== "23505") {
      return;
    }
  } catch {
    return;
  }
}

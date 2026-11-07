import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountSetupLogMessage,
  canRetrySms,
  philippineMobileE164,
  planAssessmentResultSms,
  planFailureAlertSms,
  planFinalDecisionSms,
  planReminderSms,
  planSubmissionSms,
  parseProviderPayload,
  reminderKindFor,
  reminderWindowStart,
  shouldAlertHr,
  webhookStatus,
} from "./sms-policy.ts";

const today = "2026-11-08";

describe("Philippine SMS numbers", () => {
  it("accepts the supported mobile formats and rejects incomplete numbers", () => {
    assert.equal(philippineMobileE164("0917 123 4567"), "+639171234567");
    assert.equal(philippineMobileE164("+639171234567"), "+639171234567");
    assert.equal(philippineMobileE164("639171234567"), "+639171234567");
    assert.equal(philippineMobileE164("9171234567"), null);
    assert.equal(philippineMobileE164("091712345"), null);
    assert.equal(philippineMobileE164("+14155552671"), null);
  });
});

describe("SMS event plans", () => {
  it("does not notify when a score is saved but not released", () => {
    assert.deepEqual(
      planAssessmentResultSms({
        assessmentId: "assessment-1",
        releasedAt: null,
        employeeId: "employee-1",
        employeeName: "Ada Lovelace",
        employeePhone: "09171234567",
        supervisorId: "supervisor-1",
        supervisorName: "Grace Hopper",
        supervisorPhone: "09181234567",
        evaluationNumber: 1,
        score: 90,
        rating: "Outstanding",
      }),
      [],
    );
  });

  it("notifies the employee and current supervisor only after release", () => {
    const plans = planAssessmentResultSms({
      assessmentId: "assessment-1",
      releasedAt: "2026-11-08T01:00:00Z",
      employeeId: "employee-1",
      employeeName: "Ada Lovelace",
      employeePhone: "09171234567",
      supervisorId: "supervisor-1",
      supervisorName: "Grace Hopper",
      supervisorPhone: "09181234567",
      evaluationNumber: 2,
      score: 88,
      rating: "Very Satisfactory",
    });
    assert.equal(plans.length, 2);
    assert.equal(plans[0].recipientRole, "employee");
    assert.equal(plans[1].recipientUserId, "supervisor-1");
    assert.match(plans[0].message, /Evaluation 2/);
    assert.match(plans[0].message, /Very Satisfactory/);
    assert.equal(plans[0].message.includes("feedback text"), false);
    assert.equal(
      plans[0].idempotencyKey,
      planAssessmentResultSms({
        assessmentId: "assessment-1",
        releasedAt: "2026-11-08T02:00:00Z",
        employeeId: "employee-1",
        employeeName: "Ada Lovelace",
        employeePhone: "09171234567",
        supervisorId: "supervisor-1",
        supervisorName: "Grace Hopper",
        supervisorPhone: "09181234567",
        evaluationNumber: 2,
        score: 88,
        rating: "Very Satisfactory",
      })[0].idempotencyKey,
    );
  });

  it("sends final decision SMS only after release and keeps the key stable", () => {
    assert.equal(
      planFinalDecisionSms({
        employeeId: "employee-1",
        releasedAt: null,
        decision: "passed",
        employeeName: "Ada",
        employeePhone: "09171234567",
        supervisorId: "supervisor-1",
        supervisorName: "Grace",
        supervisorPhone: "09181234567",
      }).length,
      0,
    );
    const released = planFinalDecisionSms({
      employeeId: "employee-1",
      releasedAt: "2026-11-08T01:00:00Z",
      decision: "not_passed",
      employeeName: "Ada",
      employeePhone: "09171234567",
      supervisorId: "supervisor-1",
      supervisorName: "Grace",
      supervisorPhone: "09181234567",
    });
    assert.match(released[0].message, /NOT PASSED/);
    assert.equal(released[1].recipientRole, "supervisor");
    assert.equal(released[0].idempotencyKey, "final_decision:employee-1:employee-1");
  });

  it("notifies HR when a supervisor submits and does not include a password", () => {
    const plans = planSubmissionSms({
      assessmentId: "assessment-1",
      submittedAt: "2026-11-08T01:00:00Z",
      employeeId: "employee-1",
      employeeName: "Ada Lovelace",
      supervisorName: "Grace Hopper",
      evaluationNumber: 1,
      hr: [{ id: "hr-1", name: "HR", phone: "09191234567" }],
    });
    assert.match(plans[0].message, /Grace Hopper submitted Evaluation 1/);
    assert.equal(plans[0].message.toLowerCase().includes("password"), false);
    assert.equal(accountSetupLogMessage("GGF-482731").includes("temp-secret"), false);
  });
});

describe("evaluation reminders", () => {
  const base = {
    today,
    dueSoonDays: 3,
    intervalDays: 2,
    assessmentId: "assessment-1",
    employeeId: "employee-1",
    employeeName: "Ada Lovelace",
    supervisorId: "supervisor-1",
    supervisorName: "Grace Hopper",
    supervisorPhone: "09181234567",
    evaluationNumber: 1,
    dueDate: "2026-11-10",
    workflowStatus: "scheduled" as const,
  };

  it("skips reminders until HR configures an interval", () => {
    assert.equal(planReminderSms({ ...base, intervalDays: null }).plan, null);
  });

  it("plans due-soon, due, and overdue reminders once per window and supervisor", () => {
    const dueSoon = planReminderSms(base).plan;
    assert.equal(dueSoon?.notificationType, "evaluation_reminder_due_soon");
    assert.equal(dueSoon?.idempotencyKey, planReminderSms(base).plan?.idempotencyKey);
    assert.equal(planReminderSms({ ...base, dueDate: today }).plan?.notificationType, "evaluation_reminder_due");
    assert.equal(
      planReminderSms({ ...base, dueDate: "2026-11-01" }).plan?.notificationType,
      "evaluation_reminder_overdue",
    );
    assert.notEqual(
      planReminderSms({ ...base, supervisorId: "supervisor-2" }).plan?.idempotencyKey,
      dueSoon?.idempotencyKey,
    );
    assert.equal(reminderWindowStart(today, 2), reminderWindowStart("2026-11-07", 2));
    assert.notEqual(reminderWindowStart(today, 2), reminderWindowStart("2026-11-09", 2));
  });

  it("does not remind completed, submitted, or far upcoming evaluations", () => {
    assert.equal(planReminderSms({ ...base, workflowStatus: "completed" }).plan, null);
    assert.equal(planReminderSms({ ...base, workflowStatus: "submitted" }).plan, null);
    assert.equal(planReminderSms({ ...base, dueDate: "2026-12-20" }).plan, null);
    assert.equal(
      reminderKindFor({
        workflowStatus: "returned_for_correction",
        dueDate: "2026-11-01",
        today,
        dueSoonDays: 3,
      }),
      "overdue",
    );
  });
});

describe("provider results and failure alerts", () => {
  it("accepts a provider message without treating it as delivered", () => {
    const accepted = parseProviderPayload("twilio", 201, JSON.stringify({ sid: "SM123", status: "queued" }));
    assert.equal(accepted.outcome, "sent");
    assert.equal(accepted.providerMessageId, "SM123");
    assert.equal(accepted.retryable, false);
    assert.equal(webhookStatus("delivered"), "delivered");
    assert.equal(webhookStatus("queued"), "sent");
  });

  it("marks credit and invalid-number responses rejected and redacts secrets", () => {
    const rejected = parseProviderPayload(
      "semaphore",
      402,
      "apikey=secret-value insufficient credits",
    );
    assert.equal(rejected.outcome, "rejected");
    assert.equal(rejected.errorMessage?.includes("secret-value"), false);
    assert.equal(rejected.retryable, true);
  });

  it("alerts HR once and never alerts about the alert itself", () => {
    const alerts = planFailureAlertSms({
      failedId: "sms-1",
      failedType: "assessment_result",
      employeeName: "Ada",
      hr: [{ id: "hr-1", phone: "09191234567" }],
    });
    assert.equal(alerts.length, 1);
    assert.equal(shouldAlertHr("sms_failure", "failed"), false);
    assert.equal(
      planFailureAlertSms({
        failedId: "sms-1",
        failedType: "sms_failure",
        employeeName: "Ada",
        hr: [{ id: "hr-1", phone: "09191234567" }],
      }).length,
      0,
    );
  });

  it("does not retry an accepted or exhausted message", () => {
    assert.equal(
      canRetrySms({ status: "sent", attemptCount: 1, providerMessageId: "SM1", retryable: false }),
      false,
    );
    assert.equal(
      canRetrySms({ status: "failed", attemptCount: 3, providerMessageId: null, retryable: true }),
      false,
    );
    assert.equal(
      canRetrySms({ status: "failed", attemptCount: 1, providerMessageId: null, retryable: true }),
      true,
    );
  });
});

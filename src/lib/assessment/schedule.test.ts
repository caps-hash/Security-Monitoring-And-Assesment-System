import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedTransitions,
  displayStatus,
  dueDateFor,
  planScheduleSync,
  validateAssessmentSettings,
} from "./schedule.ts";

const settings = {
  evaluation1OffsetDays: 30,
  evaluation2OffsetDays: 60,
  evaluation3OffsetDays: 90,
  dueSoonDays: 7,
};

test("due dates follow configured offsets from the start date and reject missing rules", () => {
  assert.match(validateAssessmentSettings({
    evaluation1OffsetDays: null,
    evaluation2OffsetDays: null,
    evaluation3OffsetDays: null,
    dueSoonDays: null,
  }) ?? "", /No default interval/);
  assert.equal(dueDateFor("2026-10-01", 1, settings), "2026-10-31");
  assert.equal(dueDateFor("2026-10-01", 2, settings), "2026-11-30");
  assert.equal(dueDateFor("2026-10-01", 3, settings), "2026-12-30");
});

test("date statuses stay consistent and do not overwrite workflow statuses", () => {
  assert.equal(displayStatus({ workflowStatus: "scheduled", dueDate: "2026-11-20", today: "2026-10-20", dueSoonDays: 7 }), "Upcoming");
  assert.equal(displayStatus({ workflowStatus: "scheduled", dueDate: "2026-10-25", today: "2026-10-20", dueSoonDays: 7 }), "Due Soon");
  assert.equal(displayStatus({ workflowStatus: "scheduled", dueDate: "2026-10-20", today: "2026-10-20", dueSoonDays: 7 }), "Due");
  assert.equal(displayStatus({ workflowStatus: "scheduled", dueDate: "2026-10-19", today: "2026-10-20", dueSoonDays: 7 }), "Overdue");
  assert.equal(displayStatus({ workflowStatus: "under_review", dueDate: "2026-10-01", today: "2026-10-20", dueSoonDays: 7 }), "Under Review");
  assert.equal(displayStatus({ workflowStatus: "returned_for_correction", dueDate: "2026-10-01", today: "2026-10-20", dueSoonDays: 7 }), "Returned for Correction");
  assert.equal(displayStatus({ workflowStatus: "scheduled", dueDate: "2026-10-25", today: "2026-10-20", dueSoonDays: null }), "Upcoming");
});

test("synchronization is idempotent and preserves completed workflow rows", () => {
  const first = planScheduleSync({
    settings,
    employees: [
      { id: "emp-1", active: true, startDate: "2026-10-01" },
      { id: "emp-2", active: true, startDate: null },
    ],
    existing: [],
  });
  assert.equal(first.error, null);
  assert.equal(first.inserts.length, 3);
  assert.deepEqual(first.missingStart, ["emp-2"]);

  const second = planScheduleSync({
    settings,
    employees: [{ id: "emp-1", active: true, startDate: "2026-10-01" }],
    existing: first.inserts,
  });
  assert.equal(second.inserts.length, 0);
  assert.equal(second.unchanged, 3);

  const changedStart = planScheduleSync({
    settings,
    employees: [{ id: "emp-1", active: true, startDate: "2026-10-05" }],
    existing: [
      { ...first.inserts[0], workflowStatus: "completed" },
      first.inserts[1],
      first.inserts[2],
    ],
  });
  assert.equal(changedStart.preservedWorkflow, 1);
  assert.equal(changedStart.dueDateUpdates.length, 2);
  assert.equal(changedStart.dueDateUpdates.some((row) => row.evaluationNumber === 1), false);
});

test("supervisors cannot set HR review statuses", () => {
  assert.deepEqual(allowedTransitions("scheduled", "supervisor"), ["submitted"]);
  assert.deepEqual(allowedTransitions("submitted", "supervisor"), []);
  assert.deepEqual(allowedTransitions("under_review", "hr"), ["returned_for_correction", "completed"]);
  assert.deepEqual(allowedTransitions("completed", "hr"), []);
  assert.deepEqual(allowedTransitions("returned_for_correction", "supervisor"), ["submitted"]);
});

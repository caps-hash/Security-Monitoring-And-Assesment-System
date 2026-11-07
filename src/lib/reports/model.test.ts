import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReport,
  overviewCounts,
  rankingScore,
  toCsv,
  validateRankingWeights,
  validateReportFilters,
  type ReportSnapshot,
} from "./model.ts";

const today = "2026-11-08";

function snapshot(overrides: Partial<ReportSnapshot> = {}): ReportSnapshot {
  return {
    today,
    generatedAt: "2026-11-08T01:00:00Z",
    warning: null,
    employees: [
      {
        id: "employee-1",
        employeeNumber: "GGF-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        active: true,
        supervisorId: "supervisor-1",
        supervisorName: "Grace Hopper",
        postId: "post-1",
        postName: "Gate",
        locationId: "location-1",
        locationName: "Lobby",
        shiftId: "shift-1",
        shiftName: "Day",
        startDate: "2026-01-01",
      },
    ],
    assessments: [
      {
        id: "assessment-1",
        employeeId: "employee-1",
        employeeNumber: "GGF-1",
        employeeName: "Ada Lovelace",
        supervisorId: "supervisor-1",
        supervisorName: "Grace Hopper",
        postId: "post-1",
        locationId: "location-1",
        shiftId: "shift-1",
        evaluationNumber: 1,
        dueDate: "2026-11-01",
        submittedAt: null,
        workflowStatus: "scheduled",
        officialScore: 90,
        rating: "Outstanding",
        feedbackRecorded: false,
        released: false,
      },
    ],
    decisions: [],
    sms: [],
    punches: [],
    attendance: {
      records: 0,
      presentDays: 0,
      lateRecords: 0,
      potentialAbsences: 1,
      missingTimeIn: 1,
      missingTimeOut: 0,
      latePersonnel: 0,
      officialAbsence: "unavailable",
    },
    ranking: null,
    dueSoonDays: 3,
    ...overrides,
  };
}

const filters = {
  report: "overview" as const,
  from: "",
  to: "",
  employeeId: "",
  supervisorId: "",
  postId: "",
  locationId: "",
  shiftId: "",
  status: "",
  rating: "",
  q: "",
  sort: "",
  direction: "asc" as const,
  page: 1,
};

describe("Phase 8 reports", () => {
  it("counts employees once and does not treat an unreleased decision as Not Passed", () => {
    const counts = overviewCounts(snapshot({
      decisions: [
        {
          employeeId: "employee-1",
          employeeNumber: "GGF-1",
          employeeName: "Ada Lovelace",
          supervisorId: "supervisor-1",
          supervisorName: "Grace Hopper",
          postId: null,
          locationId: null,
          shiftId: null,
          decision: "not_passed",
          issuedAt: "2026-11-08T00:00:00Z",
          releasedAt: null,
          decidedBy: "HR",
          evaluation3Status: "Completed",
          releasedScoreSummary: "Not released",
        },
      ],
    }));
    assert.equal(counts.totalEmployees, 1);
    assert.equal(counts.notPassed, 0);
    assert.equal(counts.overdue, 1);
  });

  it("hides unreleased scores and excludes submitted work from overdue", () => {
    const data = snapshot({
      assessments: [
        { ...snapshot().assessments[0], workflowStatus: "submitted", submittedAt: "2026-11-02T00:00:00Z" },
      ],
    });
    const overdue = buildReport(data, { ...filters, report: "overdue" });
    const assessment = buildReport(data, { ...filters, report: "assessment" });
    assert.equal(overdue.rows.length, 0);
    assert.equal(assessment.rows[0].score, "Not released");
    assert.equal(assessment.rows[0].status, "Submitted");
  });

  it("does not call a potential absence an official absence", () => {
    const report = buildReport(snapshot({
      punches: [
        {
          id: "absence-1",
          employeeId: "employee-1",
          employeeNumber: "GGF-1",
          employeeName: "Ada Lovelace",
          supervisorId: "supervisor-1",
          supervisorName: "Grace Hopper",
          postId: "post-1",
          postName: "Gate",
          locationId: "location-1",
          locationName: "Lobby",
          shiftId: "shift-1",
          shiftName: "Day",
          attendanceDate: "2026-11-03",
          timeIn: "No Time In",
          timeOut: "No Time Out",
          verification: "No record",
          lateStatus: "Not recorded",
          absenceStatus: "Potential absence",
        },
      ],
    }), { ...filters, report: "dtr", from: "2026-11-01", to: "2026-11-08" });
    assert.equal(report.rows[0].absenceStatus, "Potential absence");
    assert.equal(report.notes.some((note) => note.includes("Official absence is unavailable")), true);
  });

  it("does not rank incomplete data as zero when no formula is approved", () => {
    assert.equal(validateRankingWeights({ assessmentWeight: 60, attendanceWeight: 30, sourceNote: "Approved by HR.", approve: true }), "Assessment and attendance weights must total 100%.");
    assert.deepEqual(rankingScore({ settings: null, assessmentScore: null, attendancePercent: null }), {
      overall: null,
      reason: "Combined ranking is not configured.",
    });
    const report = buildReport(snapshot(), { ...filters, report: "performers" });
    assert.equal(report.rows[0].overall, "Not configured");
    assert.equal(report.rows[0].assessment, "Incomplete");
    assert.equal(report.rows[0].rank, "Not ranked");
  });

  it("escapes CSV values and rejects an inverted date range", () => {
    const csv = toCsv({
      title: "Personnel report",
      summary: [],
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: 'Ada, "Lovelace"' }],
      notes: [],
      error: null,
    });
    assert.match(csv, /"Ada, ""Lovelace"""/);
    assert.equal(validateReportFilters({ ...filters, report: "personnel", from: "2026-11-10", to: "2026-11-01" }), "The start date cannot be after the end date.");
  });
});

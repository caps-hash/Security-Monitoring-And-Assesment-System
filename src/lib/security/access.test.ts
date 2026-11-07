import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accessDecision,
  clearRateLimits,
  consumeRateLimit,
  evidencePathAllowed,
  requiredRoleForPath,
  sanitizeAuditChanges,
} from "./access.ts";

describe("Phase 9 authorization rules", () => {
  it("denies cross-role pages and inactive or anonymous sessions", () => {
    assert.equal(requiredRoleForPath("/dashboard/hr/reports"), "hr");
    assert.equal(requiredRoleForPath("/dashboard/supervisor/assessment"), "supervisor");
    assert.equal(requiredRoleForPath("/account/password"), null);
    assert.equal(accessDecision({ actorRole: "employee", active: true, target: "hr-page" }), "deny");
    assert.equal(accessDecision({ actorRole: "employee", active: true, target: "supervisor-page" }), "deny");
    assert.equal(accessDecision({ actorRole: "supervisor", active: true, target: "hr-page" }), "deny");
    assert.equal(accessDecision({ actorRole: "anonymous", active: true, target: "employee-page" }), "deny");
    assert.equal(accessDecision({ actorRole: "employee", active: false, target: "own-profile", ownsRecord: true }), "deny");
  });

  it("denies another employee's records, scores, decisions, and role changes", () => {
    assert.equal(accessDecision({ actorRole: "employee", active: true, target: "other-profile" }), "deny");
    assert.equal(accessDecision({ actorRole: "employee", active: true, target: "other-dtr" }), "deny");
    assert.equal(accessDecision({ actorRole: "employee", active: true, target: "other-photo" }), "deny");
    assert.equal(accessDecision({ actorRole: "employee", active: true, target: "official-score" }), "deny");
    assert.equal(accessDecision({ actorRole: "employee", active: true, target: "final-decision" }), "deny");
    assert.equal(accessDecision({ actorRole: "employee", active: true, target: "role-change" }), "deny");
    assert.equal(accessDecision({ actorRole: "supervisor", active: true, target: "official-score" }), "deny");
    assert.equal(accessDecision({ actorRole: "supervisor", active: true, target: "final-decision" }), "deny");
    assert.equal(accessDecision({ actorRole: "supervisor", active: true, target: "other-dtr", assigned: false }), "deny");
    assert.equal(accessDecision({ actorRole: "supervisor", active: true, target: "evaluation-file", assigned: false }), "deny");
    assert.equal(accessDecision({ actorRole: "hr", active: true, target: "role-change" }), "deny");
  });

  it("allows only scoped access that the existing policies already grant", () => {
    assert.equal(accessDecision({ actorRole: "hr", active: true, target: "audit-log" }), "allow");
    assert.equal(accessDecision({ actorRole: "employee", active: true, target: "audit-log" }), "deny");
    assert.equal(accessDecision({ actorRole: "supervisor", active: true, target: "other-profile", assigned: true }), "allow");
    assert.equal(accessDecision({ actorRole: "employee", active: true, target: "own-profile", ownsRecord: true }), "allow");
    assert.equal(accessDecision({ actorRole: "employee", active: true, target: "evaluation-file", ownsRecord: true }), "deny");
  });

  it("rejects unsafe evidence paths and secret audit values", () => {
    assert.equal(evidencePathAllowed("11111111-1111-4111-8111-111111111111", "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/time-in.jpg"), true);
    assert.equal(evidencePathAllowed("11111111-1111-4111-8111-111111111111", "33333333-3333-4333-8333-333333333333/22222222-2222-4222-8222-222222222222/time-in.jpg"), false);
    assert.equal(evidencePathAllowed("11111111-1111-4111-8111-111111111111", "../11111111-1111-4111-8111-111111111111/time-in.jpg"), false);
    assert.deepEqual(sanitizeAuditChanges({ email: "ada@example.com", password: "secret", token: "abc" }), {
      email: "ada@example.com",
    });
  });

  it("limits repeated sensitive attempts", () => {
    clearRateLimits();
    assert.equal(consumeRateLimit("user:password", 2, 1000, 0), true);
    assert.equal(consumeRateLimit("user:password", 2, 1000, 10), true);
    assert.equal(consumeRateLimit("user:password", 2, 1000, 20), false);
  });
});

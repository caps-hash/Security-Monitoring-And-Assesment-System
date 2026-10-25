import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountCreatedMessage } from "./account-notices.ts";
import {
  interpretStaffEmailChange,
  validateStaffEmail,
  validateStaffInvite,
  type StaffInviteInput,
} from "./staff-invite.ts";

const validInvite: StaffInviteInput = {
  email: "guard@example.com",
  firstName: "Ada",
  middleName: "",
  lastName: "Lovelace",
  role: "employee",
  phone: "09171234567",
};

describe("validateStaffInvite", () => {
  it("accepts employee and supervisor invitations", () => {
    assert.equal(validateStaffInvite(validInvite), null);
    assert.equal(validateStaffInvite({ ...validInvite, role: "supervisor" }), null);
  });

  it("rejects HR creation and missing identity fields", () => {
    assert.match(
      validateStaffInvite({ ...validInvite, role: "hr" }) ?? "",
      /Employee or Supervisor/,
    );
    assert.match(
      validateStaffInvite({ ...validInvite, email: "not-an-email" }) ?? "",
      /valid email/,
    );
    assert.match(
      validateStaffInvite({ ...validInvite, firstName: " " }) ?? "",
      /first and last name/,
    );
  });
});

describe("staff email changes", () => {
  it("validates an address and distinguishes applied, pending, and rejected changes", () => {
    assert.equal(validateStaffEmail("lead@example.com"), null);
    assert.match(validateStaffEmail("not-an-email") ?? "", /valid email/);

    const updated = interpretStaffEmailChange({
      requestedEmail: "new@example.com",
      previousEmail: "old@example.com",
      appliedEmail: "new@example.com",
      pendingEmail: null,
    });
    assert.equal(updated.status, "updated");

    const pending = interpretStaffEmailChange({
      requestedEmail: "new@example.com",
      previousEmail: "old@example.com",
      appliedEmail: "old@example.com",
      pendingEmail: "new@example.com",
    });
    assert.equal(pending.status, "pending");
    if (pending.status === "pending") {
      assert.match(pending.message, /old@example.com remains the sign-in email/);
    }

    const rejected = interpretStaffEmailChange({
      requestedEmail: "new@example.com",
      previousEmail: "old@example.com",
      appliedEmail: "old@example.com",
      pendingEmail: null,
    });
    assert.equal(rejected.status, "not-applied");
  });
});

describe("accountCreatedMessage", () => {
  it("does not include a password and distinguishes the two roles", () => {
    const employeeMessage = accountCreatedMessage(
      "employee",
      "guard@example.com",
      "GGF-482731",
    );
    const supervisorMessage = accountCreatedMessage(
      "supervisor",
      "lead@example.com",
      "GGF-482731",
    );

    assert.match(employeeMessage, /Employee account created/);
    assert.match(supervisorMessage, /Supervisor account created/);
    assert.match(employeeMessage, /GGF-482731/);
    assert.match(employeeMessage, /not shown here/);
    assert.equal(employeeMessage.includes("temp-secret"), false);
    assert.equal(supervisorMessage.includes("temp-secret"), false);
  });
});

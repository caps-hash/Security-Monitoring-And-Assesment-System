import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountCreatedMessage,
  buildAccountEmail,
  buildAccountSms,
  emailProviderConfigured,
  missingEmailConfigurationDetail,
  missingSmsConfigurationDetail,
  normalizePhone,
  noticeWarning,
  smsProviderName,
  toE164,
} from "./account-notices.ts";
import { mustChangePassword } from "../auth/password-requirement.ts";
import {
  assignUniqueEmployeeNumber,
  formatEmployeeNumber,
  isGeneratedEmployeeNumber,
} from "./employee-number.ts";

describe("employee numbers", () => {
  it("formats a stable GGF id and retries collisions", async () => {
    assert.equal(formatEmployeeNumber(482731), "GGF-482731");
    assert.equal(isGeneratedEmployeeNumber("GGF-482731"), true);
    assert.equal(isGeneratedEmployeeNumber("E-100"), false);

    let calls = 0;
    const employeeNumber = await assignUniqueEmployeeNumber(
      async () => {
        calls += 1;
        return calls === 1 ? "collision" : "ok";
      },
      () => (calls === 0 ? 1 : 2),
    );
    assert.equal(employeeNumber, "GGF-000002");
  });
});

describe("account notices", () => {
  it("keeps the password out of email and HR messages", () => {
    const password = "temp-secret-value";
    const email = buildAccountEmail({
      fullName: "Ada Lovelace",
      employeeNumber: "GGF-482731",
      smsSent: true,
    });
    const sms = buildAccountSms({
      employeeNumber: "GGF-482731",
      temporaryPassword: password,
    });
    const created = accountCreatedMessage("employee", "ada@example.com", "GGF-482731");
    const warning = noticeWarning(
      { status: "not_configured", detail: missingEmailConfigurationDetail() },
      { status: "failed", detail: "SMS delivery failed (provider status 503)." },
    );

    assert.equal(email.subject, "Your GLOBAL GROUND FORCE Account Has Been Created");
    assert.match(email.text, /Ada Lovelace/);
    assert.match(email.text, /GGF-482731/);
    assert.match(email.text, /sent separately via SMS/);
    assert.equal(email.text.includes(password), false);
    assert.match(sms, /GGF-482731/);
    assert.match(sms, new RegExp(password));
    assert.equal(created.includes(password), false);
    assert.match(created, /not shown here/);
    assert.equal(warning?.includes(password), false);
    assert.match(buildAccountEmail({
      fullName: "Ada Lovelace",
      employeeNumber: "GGF-482731",
      smsSent: false,
    }).text, /were not sent by SMS/);
  });

  it("normalizes phone numbers and reports missing providers", () => {
    assert.equal(normalizePhone("0917 123 4567"), "09171234567");
    assert.equal(normalizePhone("123"), null);
    assert.equal(toE164("09171234567"), "+639171234567");
    assert.equal(emailProviderConfigured({}), false);
    assert.equal(smsProviderName({}), null);
    assert.match(missingSmsConfigurationDetail(), /TWILIO_ACCOUNT_SID/);
    assert.equal(mustChangePassword({ must_change_password: true }), true);
    assert.equal(mustChangePassword({}), false);
  });
});

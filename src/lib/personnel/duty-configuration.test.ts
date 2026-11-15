import assert from "node:assert/strict";
import test from "node:test";
import {
  dutyEditorDraft,
  dutyOptionsAvailable,
  formatShiftWindow,
  isOvernightShift,
  sharedDutyWarning,
  validateDutyConfigurationInput,
} from "./duty-configuration.ts";

const validInput = {
  postName: "Main gate",
  postDescription: "",
  locationName: "Head office",
  locationAddress: "",
  shiftName: "Night",
  startTime: "20:00",
  endTime: "06:00",
  isActive: true,
};

test("accepts an overnight shift and rejects incomplete duty details", () => {
  assert.equal(validateDutyConfigurationInput(validInput), null);
  assert.equal(isOvernightShift("20:00", "06:00"), true);
  assert.equal(isOvernightShift("08:00", "16:00"), false);
  assert.equal(formatShiftWindow("20:00:00", "06:00:00"), "20:00–06:00 (overnight)");
  assert.equal(
    validateDutyConfigurationInput({ ...validInput, postName: "  " }),
    "Enter a post name.",
  );
  assert.equal(
    validateDutyConfigurationInput({
      ...validInput,
      startTime: "20:00",
      endTime: "20:00",
    }),
    "End time must differ from start time. Use an earlier end time for an overnight shift.",
  );
  assert.equal(dutyOptionsAvailable(true, true, false), false);
});

test("loads an existing duty configuration for editing without changing its identity", () => {
  const draft = dutyEditorDraft({
    id: "configuration-1",
    postId: "post-1",
    locationId: "location-1",
    shiftId: "shift-1",
    postName: "Main gate",
    postDescription: "Front entrance",
    locationName: "Head office",
    locationAddress: "1 Main Street",
    shiftName: "Morning shift",
    startTime: "08:00:00",
    endTime: "16:00:00",
    postActive: true,
    locationActive: true,
    shiftActive: true,
  });

  assert.deepEqual(draft, {
    configurationId: "configuration-1",
    postId: "post-1",
    locationId: "location-1",
    shiftId: "shift-1",
    postName: "Main gate",
    postDescription: "Front entrance",
    locationName: "Head office",
    locationAddress: "1 Main Street",
    shiftName: "Morning shift",
    startTime: "08:00",
    endTime: "16:00",
    isActive: true,
  });
});

test("warns before a shared edit or deactivation used by assignments", () => {
  assert.match(
    sharedDutyWarning({
      sharedPostUses: 0,
      sharedLocationUses: 0,
      sharedShiftUses: 0,
      assignmentCount: 2,
      deactivating: false,
    }) ?? "",
    /2 employee assignments/,
  );
  assert.match(
    sharedDutyWarning({
      sharedPostUses: 2,
      sharedLocationUses: 0,
      sharedShiftUses: 1,
      assignmentCount: 3,
      deactivating: true,
    }) ?? "",
    /shared/,
  );
});

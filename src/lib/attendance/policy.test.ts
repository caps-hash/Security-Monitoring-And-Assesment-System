import assert from "node:assert/strict";
import test from "node:test";
import {
  addManilaDays,
  decidePunch,
  durationMinutes,
  evaluateLocation,
  formatDuration,
  formatManilaTime,
  isOvernight,
  manilaDateKey,
  manilaRange,
  parseGeofenceInput,
  parseGps,
  shiftNote,
  sniffJpeg,
} from "./policy.ts";

test("records Philippine local date and overnight duration from timestamps", () => {
  const timeIn = "2026-10-20T15:00:00.000Z";
  const timeOut = "2026-10-20T18:30:00.000Z";
  assert.equal(manilaDateKey(new Date(timeIn)), "2026-10-20");
  assert.equal(manilaDateKey(new Date(timeOut)), "2026-10-21");
  assert.equal(isOvernight(timeIn, timeOut), true);
  assert.equal(durationMinutes(timeIn, timeOut), 210);
  assert.equal(durationMinutes(timeIn, null), null);
  assert.equal(formatDuration(210), "3h 30m");
  assert.equal(formatDuration(null), "Incomplete");
  assert.match(formatManilaTime(new Date(timeIn)), /PHT$/);
});

test("builds Manila ranges without inventing a work calendar", () => {
  const now = new Date("2026-10-20T15:30:00.000Z");
  assert.deepEqual(manilaRange("today", now), {
    from: "2026-10-20",
    to: "2026-10-20",
  });
  assert.deepEqual(manilaRange("week", now), {
    from: "2026-10-14",
    to: "2026-10-20",
  });
  assert.equal(manilaRange("month", now).from, "2026-10-01");
  assert.equal(addManilaDays("2026-10-20", 1), "2026-10-21");
});

test("rejects duplicate Time In and Time Out without an open session", () => {
  assert.equal(decidePunch("time_in", true, false).code, "duplicate_time_in");
  assert.equal(decidePunch("time_in", false, true).code, "duplicate_time_in");
  assert.equal(decidePunch("time_in", false, false).ok, true);
  assert.equal(decidePunch("time_out", false, false).code, "no_active_session");
  assert.equal(decidePunch("time_out", true, true).ok, true);
});

test("requires GPS and enforces only a fully configured geofence", () => {
  assert.equal(evaluateLocation(null, null).code, "gps_required");
  assert.equal(parseGps("13.14", "123.73", "0"), null);
  const gps = parseGps("13.140000", "123.730000", "12");
  assert.ok(gps);
  assert.equal(evaluateLocation(gps, null).code, "gps_captured_no_geofence");
  const outside = evaluateLocation(gps, {
    latitude: 14.6,
    longitude: 121.0,
    radiusMeters: 150,
  });
  assert.equal(outside.ok, false);
  assert.equal(outside.code, "outside_geofence");
  const inside = evaluateLocation(gps, {
    latitude: 13.140001,
    longitude: 123.730001,
    radiusMeters: 150,
  });
  assert.equal(inside.code, "inside_geofence");
});

test("does not invent a geofence radius", () => {
  assert.deepEqual(parseGeofenceInput("", "", ""), { ok: true, value: null });
  assert.equal(parseGeofenceInput("13.1", "", "").ok, false);
  assert.equal(parseGeofenceInput("13.1", "123.7", "50.5").ok, false);
});

test("compares shift windows, including a shift that crosses midnight", () => {
  const late = new Date("2026-10-20T00:30:00.000Z");
  assert.equal(shiftNote(late, "08:00", "17:00"), "late");
  const early = new Date("2026-10-19T23:30:00.000Z");
  assert.equal(shiftNote(early, "08:00", "17:00"), "early");
  const overnightPunch = new Date("2026-10-20T16:15:00.000Z");
  assert.equal(shiftNote(overnightPunch, "22:00", "06:00"), "late");
  const outside = new Date("2026-10-20T02:00:00.000Z");
  assert.equal(shiftNote(outside, "22:00", "06:00"), "outside_window");
});

test("accepts only JPEG evidence bytes", () => {
  assert.equal(sniffJpeg(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(sniffJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])), false);
  assert.equal(sniffJpeg(Uint8Array.from([0xff, 0xd8])), false);
});

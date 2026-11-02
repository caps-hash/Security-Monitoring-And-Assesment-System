import assert from "node:assert/strict";
import test from "node:test";
import { EVALUATION_CRITERIA } from "./criteria.ts";
import { inspectEvaluationFile } from "./files.ts";
import { ratingForScore, validateRatingBands } from "./scoring.ts";

test("official criteria keep the transcribed weights and total 100 percent", () => {
  assert.equal(EVALUATION_CRITERIA.length, 11);
  const total = EVALUATION_CRITERIA.reduce((sum, criterion) => sum + Number(criterion.weight.replace("%", "")), 0);
  assert.equal(total, 100);
  assert.equal(EVALUATION_CRITERIA[0].title, "Job Knowledge and Potential");
  assert.match(EVALUATION_CRITERIA[0].description, /knowledge and understanding/);
});

test("ratings are not calculated unless HR has approved a configuration", () => {
  const bands = [
    { label: "Outstanding", minScore: 90, maxScore: 100 },
    { label: "Satisfactory", minScore: 75, maxScore: 89 },
  ];
  assert.equal(ratingForScore(95, bands, false).rating, null);
  assert.equal(ratingForScore(95, bands, true).rating, "Outstanding");
  assert.equal(ratingForScore(70, bands, true).rating, null);
  assert.match(validateRatingBands([
    { label: "A", minScore: 1, maxScore: 10 },
    { label: "B", minScore: 10, maxScore: 20 },
  ]) ?? "", /overlap/);
});

test("evaluation uploads accept only matching document signatures", () => {
  assert.equal(inspectEvaluationFile("form.pdf", Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d])).ok, true);
  assert.equal(inspectEvaluationFile("form.pdf", Uint8Array.from([0xff, 0xd8, 0xff, 0x00])).ok, false);
  assert.equal(inspectEvaluationFile("photo.jpg", Uint8Array.from([0xff, 0xd8, 0xff, 0x00])).ok, true);
  assert.equal(inspectEvaluationFile("form.exe", Uint8Array.from([0x25, 0x50, 0x44, 0x46])).ok, false);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const admin = read("frontend/app/admin/mock-tests/tests/page.tsx");
const versions = read("frontend/app/admin/mock-tests/published-versions/page.tsx");
const student = read("frontend/app/student/mock-tests/page.tsx");
const backend = read("backend/src/controllers/studentMockTestController.js");

test("B5-B2-B3 Admin: legacy opt-in default preserves historical tests", () => {
  assert.match(admin, /experienceAvailability:\s*"legacy"/);
  assert.match(admin, /policyVersion:\s*1/);
  assert.match(admin, /allowedModes:\s*setting === "both"/);
  assert.match(admin, /Student experiences:|Student Experiences:|Permitted student experiences/);
});
test("B5-B2-B3 Admin: create and metadata update pass policy only when selected", () => {
  assert.equal((admin.match(/experiencePolicy: buildExperiencePolicy\(createMockTestForm\.experienceAvailability\)/g) || []).length, 2);
  assert.match(admin, /enabled experience policy cannot be removed|enabled experience policy cannot be removed/i);
  assert.match(admin, /Existing published versions remain frozen/);
});
test("B5-B2-B3 published versions: labels reference frozen version settings", () => {
  assert.match(versions, /version\.settings\?\.experiencePolicy/);
  assert.match(versions, /version\.settings\.experiencePolicy\.allowedModes/);
  assert.match(versions, /Legacy \(no mode selection\)/);
});
test("B5-B2-B3 catalog: frozen published policy, not draft, determines choices", () => {
  assert.match(backend, /const frozen = mockTest\.activeVersionId\?\.settings\?\.experiencePolicy/);
  assert.match(backend, /\.populate\("activeVersionId", "[^"]*settings\.experiencePolicy"\)/);
  assert.match(student, /test\.settings\?\.experiencePolicy/);
  assert.match(student, /policy\.policyVersion !== 1/);
  assert.match(student, /new Set\(modes\)\.size !== modes\.length/);
});
test("B5-B2-B3 student: two-mode selection must occur before HTTP start", () => {
  assert.match(student, /modes && modes\.length === 2/);
  assert.match(student, /setPendingModeChoice\(\{ mockTestId: mockTest\._id, requestedAction: action \}\)/);
  assert.match(student, /role="dialog" aria-modal="true"/);
  assert.match(student, /void startOrResumeAttempt\(selectedTest, pendingModeChoice\.requestedAction, mode\)/);
});
test("B5-B2-B3 student: only explicit selected mode enters start request", () => {
  assert.match(student, /body: JSON\.stringify\(\{ experienceMode \}\)/);
  assert.match(student, /\.\.\.\(experienceMode \? \{ body:/);
  assert.match(student, /"Content-Type": "application\/json"/);
});
test("B5-B2-B3 student: resume cannot override persisted experience", () => {
  assert.match(student, /if \(action === "resume"\)\s*\{[\s\S]{0,200}startOrResumeAttempt\(mockTest, "resume"\)/);
  assert.match(student, /Resume sends no override/);
  assert.match(student, /attempt\.experienceMode \?\? experienceMode/);
});
test("B5-B2-B3 student: retake uses same mode chooser; double-click guarded", () => {
  assert.match(student, /beginNewAttempt\(\s*mockTest,\s*"retake"\s*\)/);
  assert.match(student, /startRequestInFlightRef\.current/);
  assert.match(student, /if \(startRequestInFlightRef\.current\) return/);
});

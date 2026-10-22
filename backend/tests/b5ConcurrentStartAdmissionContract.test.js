"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../src/controllers/studentMockTestController.js"),"utf8");
const model=fs.readFileSync(path.join(__dirname,"../src/models/TestAttemptAdmissionGuard.js"),"utf8");
const start=source.slice(source.indexOf("const startMockTestAttempt = async"),source.indexOf("// Read-only, ownership-checked state refresh"));
test("B5 admission guard identity is a deterministic tuple digest and unique MongoDB _id",()=>{
  assert.match(model,/createHash\("sha256"\)/);assert.match(model,/JSON\.stringify\(tuple\)/);
  assert.match(model,/_id:\s*\{ type: String, required: true \}/);
  assert.doesNotMatch(model,/syncIndexes\(|createIndexes\(|dropIndex\(/);
});
test("B5 real transactional guard write precedes active and quota checks",()=>{
  const ids=["await TestAttemptAdmissionGuard.updateOne", "const activeCount = await TestAttempt.countDocuments", "const usedAttempts = await TestAttempt.countDocuments", "await TestAttempt.create([", "await TestAttemptDetail.create(["];
  const positions=ids.map(s=>start.indexOf(s));assert.ok(positions.every(p=>p>=0));
  assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
  assert.match(start,/\$inc: \{ revision: 1 \}/);assert.match(start,/\{ upsert: true, session \}/);
  assert.match(start,/session\.withTransaction\(async \(\) =>/);
});
test("B5 session and historical-version integrity",()=>{
  assert.match(start,/TestAttempt\.findOne\(activeFilter\)\.session\(session\)/);
  assert.match(start,/existingAttempt\.save\(\{ session \}\)/);
  assert.match(start,/getOrCreateAttemptDetail\(\s*tenantId, existingAttempt, historicalVersion, session/);
  assert.match(start,/getNextAttemptNumber\(\s*tenantId, studentId, mockTest\._id, session/);
  assert.match(source,/const getNextAttemptNumber = async \(tenantId, studentId, mockTestId, session = null\)/);
  assert.match(start,/TestAttempt\.create\(\[\{/);assert.match(start,/TestAttemptDetail\.create\(\[\{/);
  assert.doesNotMatch(start,/TestAttempt\.deleteOne/);
});
test("B5 immutable selected mode, paid entitlement and quota preserved",()=>{
  assert.match(start,/validateResumeExperience\(/);assert.match(start,/hasActiveMockTestEntitlement\(/);
  assert.match(start,/mockTestVersion\.settings\?\.experiencePolicy/);
  assert.match(start,/status: \{ \$in: \["in_progress", "submitted", "expired"\] \}/);
  assert.match(start,/Maximum attempt limit reached/);
});
test("B5 bounded retry and ambiguous commit are fail-closed",()=>{
  assert.match(start,/round < 3/);assert.match(start,/UnknownTransactionCommitResult/);
  assert.match(start,/TransientTransactionError/);assert.match(start,/await session\.endSession\(\)/);
  const segment=start.slice(start.indexOf("session.withTransaction"),start.indexOf("return res.status(outcome.statusCode)"));
  assert.doesNotMatch(segment,/res\.status\(/);
});

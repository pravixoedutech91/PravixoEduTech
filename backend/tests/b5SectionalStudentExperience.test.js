"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const MockTest = require("../src/models/MockTest");
const MockTestVersion = require("../src/models/MockTestVersion");
const TestAttempt = require("../src/models/TestAttempt");
const TestAttemptDetail = require("../src/models/TestAttemptDetail");
const {
  startMockTestAttempt,
  getMockTestAttemptState,
} = require("../src/controllers/studentMockTestController");

const ids = {
  tenant: "pravixoedutech",
  student: "507f1f77bcf86cd799439011",
  anotherStudent: "507f1f77bcf86cd799439016",
  mockTest: "507f1f77bcf86cd799439012",
  version: "507f1f77bcf86cd799439013",
  attempt: "507f1f77bcf86cd799439014",
  reasoning: "507f1f77bcf86cd799439021",
  maths: "507f1f77bcf86cd799439022",
};

const initialFunctions = {
  testFind: MockTest.findOne,
  versionFind: MockTestVersion.findOne,
  attemptFind: TestAttempt.findOne,
  attemptCreate: TestAttempt.create,
  attemptCount: TestAttempt.countDocuments,
  attemptDelete: TestAttempt.deleteOne,
  detailFind: TestAttemptDetail.findOne,
  detailCreate: TestAttemptDetail.create,
};

const response = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  status(code) { this.statusCode = code; return this; },
  json(data) { this.body = data; return this; },
  set(name, value) { this.headers[name] = value; return this; },
});

const makeVersion = (mode) => ({
  _id: ids.version,
  mockTestId: ids.mockTest,
  versionNumber: 1,
  title: "B5 Sectional Test",
  slug: "b5-sectional",
  accessType: "free",
  testType: "mock",
  examPatternSnapshot: {
    name: "B5 Pattern",
    examType: "railway",
    timingMode: mode,
    timingPolicyVersion: 1,
    totalDurationMinutes: 30,
  },
  settings: { maxAttempts: 3, allowResume: true, solutionVisibility: "after_submit" },
  sections: [
    {
      sectionSlug: "reasoning", name: "Reasoning", order: 1,
      durationMinutes: 10, questionCount: 1,
      questionGroups: [{ questionGroupId: "g1", title: "First group", passageEn: "CURRENT_PASSAGE" }],
      questions: [{
        _id: ids.reasoning, questionId: ids.reasoning, order: 1,
        questionType: "mcq", questionTextEn: "CURRENT_QUESTION",
        options: [{ optionId: "A", textEn: "CURRENT_OPTION" }],
        marks: 1, negativeMarks: 0,
      }],
    },
    {
      sectionSlug: "maths", name: "Maths", order: 2,
      durationMinutes: 20, questionCount: 1,
      questionGroups: [{ questionGroupId: "g2", title: "Future group", passageEn: "FUTURE_PASSAGE_SECRET" }],
      questions: [{
        _id: ids.maths, questionId: ids.maths, order: 1,
        questionType: "mcq", questionTextEn: "FUTURE_QUESTION_SECRET",
        options: [{ optionId: "A", textEn: "FUTURE_OPTION_SECRET" }],
        marks: 1, negativeMarks: 0,
      }],
    },
  ],
});

const req = (student = ids.student) => ({
  user: { _id: student, tenantId: ids.tenant, role: "student" },
  params: { mockTestId: ids.mockTest, attemptId: ids.attempt },
});

function install(mode = "sectional") {
  const state = {
    mock: { _id: ids.mockTest, tenantId: ids.tenant, accessType: "free", activeVersionId: ids.version, isActive: true, isPublished: true },
    version: makeVersion(mode),
    attempt: null,
    detail: null,
    writes: 0,
    unauthorizedQueries: 0,
  };

  MockTest.findOne = async (query) => (
    query.tenantId === ids.tenant && String(query._id) === ids.mockTest &&
    query.isActive === true && query.isPublished === true
      ? state.mock : null
  );
  MockTestVersion.findOne = async (query) => (
    String(query._id) === ids.version && query.tenantId === ids.tenant
      ? state.version : null
  );
  TestAttempt.findOne = (query) => {
    if (query && query.status === "in_progress") {
      if (query._id) {
        if (query.studentId !== ids.student || query.tenantId !== ids.tenant) {
          state.unauthorizedQueries++;
          return Promise.resolve(null);
        }
        return Promise.resolve(state.attempt);
      }
      return Promise.resolve(state.attempt);
    }
    return { sort() { return this; }, async select() { return null; } };
  };
  TestAttempt.countDocuments = async () => 0;
  TestAttempt.create = async (data) => {
    state.writes++;
    state.attempt = { _id: ids.attempt, ...data, async save() { state.writes++; return this; } };
    return state.attempt;
  };
  TestAttempt.deleteOne = async () => { state.writes++; return { deletedCount: 1 }; };
  TestAttemptDetail.findOne = async () => state.detail;
  TestAttemptDetail.create = async (data) => {
    state.writes++;
    state.detail = { ...data, _id: "507f1f77bcf86cd799439015" };
    return state.detail;
  };
  return state;
}

function restore() {
  MockTest.findOne = initialFunctions.testFind;
  MockTestVersion.findOne = initialFunctions.versionFind;
  TestAttempt.findOne = initialFunctions.attemptFind;
  TestAttempt.create = initialFunctions.attemptCreate;
  TestAttempt.countDocuments = initialFunctions.attemptCount;
  TestAttempt.deleteOne = initialFunctions.attemptDelete;
  TestAttemptDetail.findOne = initialFunctions.detailFind;
  TestAttemptDetail.create = initialFunctions.detailCreate;
}

const assertNoFutureContent = (data) => {
  const serialized = JSON.stringify(data);
  for (const secret of ["FUTURE_PASSAGE_SECRET", "FUTURE_QUESTION_SECRET", "FUTURE_OPTION_SECRET"]) {
    assert.equal(serialized.includes(secret), false, `Leaked ${secret}`);
  }
};

// Fixture patches are confined to this test process and always restored.
test("B5 secure sectional delivery and read-only boundary refresh", async (t) => {
  try {
    await t.test("start exposes active content only while preserving section metadata", async () => {
      const state = install();
      const res = response();
      await startMockTestAttempt(req(), res);
      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      const data = res.body.data;
      assert.equal(data.attempt.timing.mode, "sectional");
      assert.equal(data.test.contentScope, "active_section");
      assert.equal(data.test.sections[0].questions.length, 1);
      assert.equal(data.test.sections[1].questionCount, 1);
      assert.deepEqual(data.test.sections[1].questions, []);
      assert.deepEqual(data.test.sections[1].questionGroups, []);
      assertNoFutureContent(data);
      assert.equal(state.writes, 2);
    });

    await t.test("GET state is read-only and owner-checked", async () => {
      const state = install();
      const start = response();
      await startMockTestAttempt(req(), start);
      assert.equal(start.statusCode, 201);
      const baselineWrites = state.writes;
      const res = response();
      await getMockTestAttemptState(req(), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers["Cache-Control"], "private, no-store");
      assertNoFutureContent(res.body.data);
      assert.equal(state.writes, baselineWrites);
      const foreign = response();
      await getMockTestAttemptState(req(ids.anotherStudent), foreign);
      assert.equal(foreign.statusCode, 404);
      assert.equal(state.writes, baselineWrites);
    });

    await t.test("after time boundary refresh exposes new active content, never previous content", async () => {
      const state = install();
      const start = response();
      await startMockTestAttempt(req(), start);
      const now = Date.now();
      state.attempt.startedAt = new Date(now - 12 * 60 * 1000);
      state.attempt.expiresAt = new Date(now + 18 * 60 * 1000);
      state.attempt.timingState.sectionWindows = [
        { sectionSlug: "reasoning", order: 1, startsAt: new Date(now - 12 * 60 * 1000), expiresAt: new Date(now - 2 * 60 * 1000) },
        { sectionSlug: "maths", order: 2, startsAt: new Date(now - 2 * 60 * 1000), expiresAt: new Date(now + 18 * 60 * 1000) },
      ];
      const baselineWrites = state.writes;
      const res = response();
      await getMockTestAttemptState(req(), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.attempt.timing.activeSection.sectionSlug, "maths");
      assert.deepEqual(res.body.data.test.sections[0].questions, []);
      assert.deepEqual(res.body.data.test.sections[0].questionGroups, []);
      assert.equal(res.body.data.test.sections[1].questions.length, 1);
      assert.equal(JSON.stringify(res.body.data).includes("CURRENT_PASSAGE"), false);
      assert.equal(state.writes, baselineWrites);
    });

    await t.test("expired attempt GET denies all questions with no writes", async () => {
      const state = install();
      const start = response();
      await startMockTestAttempt(req(), start);
      const now = Date.now();
      state.attempt.expiresAt = new Date(now - 1000);
      const before = state.writes;
      const res = response();
      await getMockTestAttemptState(req(), res);
      assert.equal(res.statusCode, 410);
      assert.equal(res.body.data, undefined);
      assert.equal(state.writes, before);
    });

    await t.test("global mode preserves access to both sections", async () => {
      const state = install("global");
      const start = response();
      await startMockTestAttempt(req(), start);
      assert.equal(start.statusCode, 201);
      assert.equal(start.body.data.attempt.timing.mode, "global");
      assert.equal(start.body.data.test.contentScope, "all_sections");
      assert.equal(start.body.data.test.sections[0].questions.length, 1);
      assert.equal(start.body.data.test.sections[1].questions.length, 1);
      const before = state.writes;
      const get = response();
      await getMockTestAttemptState(req(), get);
      assert.equal(get.statusCode, 200);
      assert.equal(get.body.data.test.sections[1].questions.length, 1);
      assert.equal(state.writes, before);
    });

    await t.test("assigned access denies attempt state even to attempt owner", async () => {
      const state = install();
      const start = response();
      await startMockTestAttempt(req(), start);
      state.mock.accessType = "assigned";
      const before = state.writes;
      const res = response();
      await getMockTestAttemptState(req(), res);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.data, undefined);
      assert.equal(state.writes, before);
    });

    await t.test("invalid or missing attempt is rejected without revealing content", async () => {
      const state = install();
      const res = response();
      await getMockTestAttemptState({ ...req(), params: { attemptId: "invalid" } }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(state.writes, 0);
      const missing = response();
      await getMockTestAttemptState(req(), missing);
      assert.equal(missing.statusCode, 404);
    });
  } finally {
    restore();
  }
});

test("B5 student client requires server-scoped content and refreshes without restarting attempts", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const page = fs.readFileSync(path.resolve(__dirname, "../../frontend/app/student/attempts/[attemptId]/page.tsx"), "utf8");
  const routes = fs.readFileSync(path.resolve(__dirname, "../src/routes/studentMockTestRoutes.js"), "utf8");
  assert.match(page, /payload\?\.test\.contentScope === "active_section"/);
  assert.match(page, /\/api\/student\/attempts\/\$\{attemptId\}\/state/);
  assert.match(page, /testSection\.sectionSlug !== activeSectionSlug/);
  assert.match(page, /isSectional && !sectionWindowIsOpen/);
  assert.match(routes, /"\/attempts\/:attemptId\/state"/);
  assert.match(routes, /checkFeatureAccess\("mockTests"\)/);
});

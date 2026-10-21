"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const MockTest = require("../src/models/MockTest");
const MockTestVersion = require("../src/models/MockTestVersion");
const ExamPattern = require("../src/models/ExamPattern");
const Question = require("../src/models/Question");
const { createMockTest, updateMockTest, publishMockTest } = require("../src/controllers/mockTestController");
const {
  validateExperiencePolicy,
  createExperiencePolicySchema,
} = require("../src/utils/experiencePolicy");

const oid = {
  user: "507f1f77bcf86cd799439001",
  test: "507f1f77bcf86cd799439002",
  exam: "507f1f77bcf86cd799439003",
  question: "507f1f77bcf86cd799439004",
  version: "507f1f77bcf86cd799439005",
};
const dual = () => ({ policyVersion: 1, allowedModes: ["exam_simulation", "practice"] });
const single = () => ({ policyVersion: 1, allowedModes: ["exam_simulation"] });
const responder = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const request = (body = {}) => ({
  user: { _id: oid.user, tenantId: "pravixoedutech", role: "tenant_admin" },
  params: { id: oid.test }, body, query: {},
});

// Pure policy rules: these checks require no database connection.
test("B5-B2-B1 policy: legacy absent is not silently enabled", () => {
  const result = validateExperiencePolicy(undefined);
  assert.equal(result.valid, true);
  assert.equal(result.policy, undefined);
});

test("B5-B2-B1 policy: each explicitly allowed configuration creates an independent snapshot", () => {
  for (const value of [single(), { policyVersion: 1, allowedModes: ["practice"] }, dual()]) {
    const result = validateExperiencePolicy(value);
    assert.equal(result.valid, true);
    assert.deepEqual(result.policy, value);
    assert.notStrictEqual(result.policy, value);
    assert.notStrictEqual(result.policy.allowedModes, value.allowedModes);
    value.allowedModes.push("UNAUTHORIZED");
    assert.equal(result.policy.allowedModes.includes("UNAUTHORIZED"), false);
  }
});

test("B5-B2-B1 policy: rejects invalid and ambiguous configurations", () => {
  const invalid = [
    null, "practice", [], {},
    { allowedModes: ["practice"] },
    { policyVersion: "1", allowedModes: ["practice"] },
    { policyVersion: 0, allowedModes: ["practice"] },
    { policyVersion: 2, allowedModes: ["practice"] },
    { policyVersion: 1, allowedModes: [] },
    { policyVersion: 1, allowedModes: "practice" },
    { policyVersion: 1, allowedModes: ["practice", "practice"] },
    { policyVersion: 1, allowedModes: ["practice", "unknown"] },
    { policyVersion: 1, allowedModes: ["Practice"] },
    { policyVersion: 1, allowedModes: ["practice", "exam_simulation", "practice"] },
    { policyVersion: 1, allowedModes: ["practice"], debugOverride: true },
  ];
  for (const candidate of invalid) {
    assert.equal(validateExperiencePolicy(candidate).valid, false, JSON.stringify(candidate));
  }
});

test("B5-B2-B1 schema: draft and version opt-in is absent by default", () => {
  for (const Model of [MockTest, MockTestVersion]) {
    const doc = new Model();
    assert.equal(doc.settings.experiencePolicy, undefined);
    assert.ok(Model.schema.path("settings.experiencePolicy"));
  }
});

test("B5-B2-B1 schema: nested experience policy validates supported modes", () => {
  const probeSchema = new mongoose.Schema({
    policy: { type: createExperiencePolicySchema(mongoose), default: undefined },
  });
  const Probe = mongoose.models.B5ExperiencePolicyValidationProbe ||
    mongoose.model("B5ExperiencePolicyValidationProbe", probeSchema);
  const valid = new Probe({ policy: dual() });
  assert.equal(valid.validateSync(), undefined);
  assert.equal(new Probe().policy, undefined);
  for (const bad of [
    { policyVersion: 1, allowedModes: [] },
    { policyVersion: 1, allowedModes: ["practice", "practice"] },
    { policyVersion: 1, allowedModes: ["unknown"] },
    { policyVersion: 7, allowedModes: ["practice"] },
  ]) {
    assert.ok(new Probe({ policy: bad }).validateSync(), JSON.stringify(bad));
  }
});

const makeDraft = (policy, testType = "mock") => {
  const settings = { maxAttempts: 2, shuffleQuestions: true, shuffleOptions: true };
  if (policy !== undefined) settings.experiencePolicy = policy;
  const draft = {
    _id: oid.test,
    tenantId: "pravixoedutech",
    title: "B5 Test",
    slug: "b5-test",
    examPatternId: oid.exam,
    sections: [{
      sectionSlug: "reasoning", name: "Reasoning", sectionType: "mcq",
      durationMinutes: 30, questionCount: 1, marksPerQuestion: 1,
      negativeMarks: 0, order: 1,
      questions: [{ questionId: oid.question, order: 1 }],
    }],
    accessType: "free", testType, settings,
    isPublished: false, isActive: true,
    markModified() {},
    async save() { this.saveCalls = (this.saveCalls || 0) + 1; return this; },
    toObject() {
      return {
        title: this.title, slug: this.slug, examPatternId: this.examPatternId,
        sections: this.sections, accessType: this.accessType,
        testType: this.testType, settings: this.settings,
      };
    },
  };
  return draft;
};

const makePattern = () => ({
  _id: oid.exam, tenantId: "pravixoedutech", isActive: true,
  examType: "railway", name: "RRB", timingMode: "global", totalDurationMinutes: 30,
  sections: [{ slug: "reasoning", name: "Reasoning", durationMinutes: 30,
    questionCount: 1, marksPerQuestion: 1, negativeMarks: 0 }],
});

const originals = {
  findTest: MockTest.findOne,
  createTest: MockTest.create,
  updateTest: MockTest.findOneAndUpdate,
  findPattern: ExamPattern.findOne,
  findQuestion: Question.find,
  findVersion: MockTestVersion.findOne,
  createVersion: MockTestVersion.create,
};

async function withMockedController(draft, callback) {
  const state = {
    createdVersions: [], createMockCalls: 0, updateCalls: 0,
    patternQueries: 0, versionReads: 0,
  };
  MockTest.findOne = async () => draft;
  MockTest.create = async (data) => { state.createMockCalls++; return data; };
  MockTest.findOneAndUpdate = async () => { state.updateCalls++; return draft; };
  ExamPattern.findOne = async () => { state.patternQueries++; return makePattern(); };
  Question.find = async () => [{
    _id: oid.question, questionType: "mcq", sourceType: "original",
    questionTextEn: "Question", questionTextHi: "प्रश्न",
    options: [{ optionId: "A", textEn: "Yes" }], correctOptionId: "A",
  }];
  MockTestVersion.findOne = () => {
    state.versionReads++;
    return { sort: async () => null };
  };
  MockTestVersion.create = async (data) => {
    // Simulate storage independence: snapshot the publication payload when created.
    const saved = JSON.parse(JSON.stringify(data));
    state.createdVersions.push(saved);
    return { _id: oid.version, ...saved };
  };
  try { await callback(state); }
  finally {
    MockTest.findOne = originals.findTest;
    MockTest.create = originals.createTest;
    MockTest.findOneAndUpdate = originals.updateTest;
    ExamPattern.findOne = originals.findPattern;
    Question.find = originals.findQuestion;
    MockTestVersion.findOne = originals.findVersion;
    MockTestVersion.create = originals.createVersion;
  }
}

test("B5-B2-B1 create: malformed policy rejected before database operations", async () => {
  await withMockedController(makeDraft(undefined), async (state) => {
    const body = makeDraft(undefined).toObject();
    body.settings.experiencePolicy = { policyVersion: 1, allowedModes: ["practice", "practice"] };
    const res = responder();
    await createMockTest(request(body), res);
    assert.equal(res.statusCode, 400);
    assert.equal(state.createMockCalls, 0);
    assert.equal(state.patternQueries, 0);
  });
});

test("B5-B2-B1 update: malformed policy rejected without writes", async () => {
  await withMockedController(makeDraft(undefined), async (state) => {
    const res = responder();
    await updateMockTest(request({ settings: {
      experiencePolicy: { policyVersion: 1, allowedModes: ["unknown"] },
    } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(state.updateCalls, 0);
    assert.equal(state.patternQueries, 0);
  });
});

test("B5-B2-B1 publish: old draft omits policy and keeps legacy version untouched", async () => {
  await withMockedController(makeDraft(undefined), async (state) => {
    const res = responder();
    await publishMockTest(request(), res);
    assert.equal(res.statusCode, 201);
    assert.equal(state.createdVersions.length, 1);
    assert.equal(Object.hasOwn(state.createdVersions[0].settings, "experiencePolicy"), false);
  });
});

test("B5-B2-B1 publish: allowed policy is frozen in a separate version snapshot", async () => {
  const draft = makeDraft(dual());
  await withMockedController(draft, async (state) => {
    const res = responder();
    await publishMockTest(request(), res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    assert.equal(state.createdVersions.length, 1);
    const published = state.createdVersions[0];
    assert.deepEqual(published.settings.experiencePolicy, dual());
    assert.equal(published.settings.maxAttempts, 2);
    draft.settings.experiencePolicy.allowedModes.splice(1, 1);
    assert.deepEqual(published.settings.experiencePolicy, dual());
    assert.equal(draft.activeVersionId, oid.version);
  });
});

test("B5-B2-B1 publish: invalid persisted policy denies creation before version lookup", async () => {
  await withMockedController(makeDraft({ policyVersion: 1, allowedModes: [] }), async (state) => {
    const res = responder();
    await publishMockTest(request(), res);
    assert.equal(res.statusCode, 400);
    assert.equal(state.createdVersions.length, 0);
    assert.equal(state.versionReads, 0);
  });
});

test("B5-B2-B1 publish: PYQ shuffle restrictions remain regardless of experience", async () => {
  await withMockedController(makeDraft(single(), "pyq"), async (state) => {
    const res = responder();
    await publishMockTest(request(), res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(state.createdVersions[0].settings.experiencePolicy, single());
    assert.equal(state.createdVersions[0].settings.shuffleQuestions, false);
    assert.equal(state.createdVersions[0].settings.shuffleOptions, false);
  });
});

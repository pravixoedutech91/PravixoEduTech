"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const TestAttemptAdmissionGuard = require("../src/models/TestAttemptAdmissionGuard");

const MockTest = require("../src/models/MockTest");
const MockTestVersion = require("../src/models/MockTestVersion");
const TestAttempt = require("../src/models/TestAttempt");
const TestAttemptDetail = require("../src/models/TestAttemptDetail");

const {
  startMockTestAttempt,
} = require("../src/controllers/studentMockTestController");

const IDS = {
  student: "507f1f77bcf86cd799439011",
  test: "507f1f77bcf86cd799439012",
  version: "507f1f77bcf86cd799439013",
  attempt: "507f1f77bcf86cd799439014",
  detail: "507f1f77bcf86cd799439015",
};

const tenantId = "pravixoedutech";

const originals = {
  testFind: MockTest.findOne,
  versionFind: MockTestVersion.findOne,
  attemptFind: TestAttempt.findOne,
  attemptCount: TestAttempt.countDocuments,
  attemptCreate: TestAttempt.create,
  attemptDelete: TestAttempt.deleteOne,
  detailFind: TestAttemptDetail.findOne,
  detailCreate: TestAttemptDetail.create,
  startSession: mongoose.startSession,
  admissionWrite: TestAttemptAdmissionGuard.updateOne,
};

let currentAttempt;
let currentDetail;
let version;
let createdAttempts;
let createdDetails;
let deletedAttempts;
let attemptSaveCalls;

const makeVersion = (mode = "sectional") => ({
  _id: IDS.version,
  mockTestId: IDS.test,
  versionNumber: 1,
  title: "Timing Runtime Contract",
  slug: "timing-runtime-contract",
  accessType: "free",
  testType: "mock",
  examPatternSnapshot: {
    timingMode: mode,
    timingPolicyVersion: 1,
    totalDurationMinutes: 30,
    allowSectionSwitching: false,
    allowQuestionNavigation: true,
    allowLanguageSwitching: true,
  },
  settings: {
    maxAttempts: 3,
    allowResume: true,
    solutionVisibility: "after_submit",
  },
  sections: [
    {
      sectionSlug: "reasoning",
      order: 1,
      durationMinutes: 10,
      questions: [],
    },
    {
      sectionSlug: "maths",
      order: 2,
      durationMinutes: 20,
      questions: [],
    },
  ],
});

const makeResponse = () => ({
  statusCode: 200,
  body: null,

  status(code) {
    this.statusCode = code;
    return this;
  },

  json(payload) {
    this.body = payload;
    return this;
  },
});

const runStart = async () => {
  const req = {
    user: {
      _id: IDS.student,
      tenantId,
      role: "student",
    },
    params: {
      mockTestId: IDS.test,
    },
  };

  const res = makeResponse();

  await startMockTestAttempt(req, res);

  return res;
};

// Preserve the old assertions while supporting session-scoped query chains.
const queryResult = (read) => ({
  session(session) { assert.ok(session, "transactional read requires session"); return Promise.resolve().then(read); },
  sort() { return this; },
  select() { return this; },
  then(resolve, reject) { return Promise.resolve().then(read).then(resolve, reject); },
});

const instrumentAttempt = (attempt) => {
  attempt.save = async function () {
    attemptSaveCalls += 1;
    return this;
  };

  return attempt;
};

const installMocks = () => {
  createdAttempts = [];
  createdDetails = [];
  deletedAttempts = [];
  attemptSaveCalls = 0;
  currentAttempt = null;
  currentDetail = null;
  version = makeVersion();

  MockTest.findOne = () => queryResult(() => ({
    _id: IDS.test,
    tenantId,
    activeVersionId: IDS.version,
    isActive: true,
    isPublished: true,
    accessType: "free",
  }));

  MockTestVersion.findOne = () => queryResult(() => version);
  mongoose.startSession = async () => ({
    async withTransaction(run) { return run(); },
    async endSession() {},
  });
  TestAttemptAdmissionGuard.updateOne = async (_filter, _update, options) => {
    assert.ok(options?.session, "admission write requires session");
    assert.equal(options.upsert, true);
  };
  TestAttempt.findOne = (filter) => queryResult(() => {
    if (filter && filter.status === "in_progress") return currentAttempt;
    return currentAttempt ? { attemptNumber: currentAttempt.attemptNumber } : null;
  });

  TestAttempt.countDocuments = (filter) => queryResult(() => (
    filter.status === "in_progress" ? Number(Boolean(currentAttempt)) : 0
  ));

  TestAttempt.create = async (docs, options) => {
    assert.ok(Array.isArray(docs));
    assert.ok(options?.session);
    const payload = docs[0];
    createdAttempts.push(payload);

    currentAttempt = instrumentAttempt({
      _id: IDS.attempt,
      ...payload,
    });

    return [currentAttempt];
  };

  TestAttempt.deleteOne = async (query) => {
    deletedAttempts.push(query);
    return { deletedCount: 1 };
  };

  TestAttemptDetail.findOne = () => queryResult(() => currentDetail);

  TestAttemptDetail.create = async (docs, options) => {
    assert.ok(Array.isArray(docs));
    assert.ok(options?.session);
    const payload = docs[0];
    createdDetails.push(payload);

    currentDetail = {
      _id: IDS.detail,
      ...payload,

      async save() {
        return this;
      },
    };

    return [currentDetail];
  };
};

const restoreMocks = () => {
  MockTest.findOne = originals.testFind;
  MockTestVersion.findOne = originals.versionFind;
  TestAttempt.findOne = originals.attemptFind;
  TestAttempt.countDocuments = originals.attemptCount;
  TestAttempt.create = originals.attemptCreate;
  TestAttempt.deleteOne = originals.attemptDelete;
  TestAttemptDetail.findOne = originals.detailFind;
  TestAttemptDetail.create = originals.detailCreate;
  mongoose.startSession = originals.startSession;
  TestAttemptAdmissionGuard.updateOne = originals.admissionWrite;
};

test(
  "SECTION-TIMER-B3B isolated controller runtime",
  { concurrency: false },
  async (t) => {
    try {
      await t.test(
        "sectional start persists absolute windows and returns safe timing",
        async () => {
          installMocks();

          const res = await runStart();

          assert.equal(res.statusCode, 201);
          assert.equal(res.body.success, true);
          assert.equal(createdAttempts.length, 1);
          assert.equal(createdDetails.length, 1);
          assert.equal(deletedAttempts.length, 0);

          const attempt = createdAttempts[0];
          const windows = attempt.timingState.sectionWindows;

          assert.equal(attempt.timingState.mode, "sectional");
          assert.equal(attempt.timingState.policyVersion, 1);
          assert.equal(windows.length, 2);

          assert.equal(
            new Date(windows[0].startsAt).getTime(),
            new Date(attempt.startedAt).getTime()
          );

          assert.equal(
            new Date(windows[0].expiresAt).getTime(),
            new Date(windows[1].startsAt).getTime()
          );

          assert.equal(
            new Date(windows[1].expiresAt).getTime(),
            new Date(attempt.expiresAt).getTime()
          );

          assert.equal(
            new Date(attempt.expiresAt).getTime() -
              new Date(attempt.startedAt).getTime(),
            30 * 60 * 1000
          );

          const data = res.body.data;

          assert.equal(data.resumed, false);
          assert.equal(data.attempt.timing.mode, "sectional");

          assert.equal(
            data.attempt.timing.activeSection.sectionSlug,
            "reasoning"
          );

          assert.deepEqual(
            data.attempt.timing.lockedSectionSlugs,
            ["maths"]
          );

          assert.deepEqual(
            data.attempt.timing.expiredSectionSlugs,
            []
          );

          assert.equal(
            new Date(data.serverTime).getTime(),
            new Date(attempt.startedAt).getTime()
          );

          assert.equal(
            Object.hasOwn(data.attempt.timing, "sectionWindows"),
            false
          );

          const output = JSON.stringify(data);

          assert.equal(
            output.includes('"correctOptionId"'),
            false
          );

          assert.equal(
            output.includes('"explanationEn"'),
            false
          );

          assert.equal(
            output.includes('"explanationHi"'),
            false
          );
        }
      );

      await t.test(
        "sectional resume preserves windows and does not create another attempt",
        async () => {
          installMocks();

          const first = await runStart();

          assert.equal(first.statusCode, 201);

          const windowsBefore = JSON.stringify(
            currentAttempt.timingState.sectionWindows
          );

          const startedBefore =
            new Date(currentAttempt.startedAt).getTime();

          const expiresBefore =
            new Date(currentAttempt.expiresAt).getTime();

          const resumed = await runStart();

          assert.equal(resumed.statusCode, 200);
          assert.equal(resumed.body.data.resumed, true);
          assert.equal(createdAttempts.length, 1);
          assert.equal(createdDetails.length, 1);
          assert.equal(attemptSaveCalls, 1);

          assert.equal(
            JSON.stringify(currentAttempt.timingState.sectionWindows),
            windowsBefore
          );

          assert.equal(
            new Date(currentAttempt.startedAt).getTime(),
            startedBefore
          );

          assert.equal(
            new Date(currentAttempt.expiresAt).getTime(),
            expiresBefore
          );

          assert.equal(
            resumed.body.data.attempt.timing.mode,
            "sectional"
          );
        }
      );

      await t.test(
        "legacy global resume does not backfill timingState",
        async () => {
          installMocks();

          const startedAt = new Date(Date.now() - 60000);
          const expiresAt = new Date(Date.now() + 600000);

          currentAttempt = instrumentAttempt({
            _id: IDS.attempt,
            tenantId,
            studentId: IDS.student,
            mockTestId: IDS.test,
            mockTestVersionId: IDS.version,
            attemptNumber: 1,
            status: "in_progress",
            startedAt,
            expiresAt,
            totalDurationSeconds: 900,
            timeSpentSeconds: 60,
          });

          currentDetail = {
            _id: IDS.detail,
            answers: [],
            expiresAt: new Date(Date.now() + 86400000),

            async save() {
              return this;
            },
          };

          const res = await runStart();

          assert.equal(res.statusCode, 200);
          assert.equal(res.body.data.resumed, true);
          assert.equal(createdAttempts.length, 0);
          assert.equal(createdDetails.length, 0);

          assert.equal(
            Object.hasOwn(currentAttempt, "timingState"),
            false
          );

          const timing = res.body.data.attempt.timing;

          assert.equal(timing.mode, "global");
          assert.equal(timing.policyVersion, 0);
          assert.equal(timing.activeSection, null);

          assert.deepEqual(
            timing.expiredSectionSlugs,
            []
          );

          assert.deepEqual(
            timing.lockedSectionSlugs,
            []
          );
        }
      );
      await t.test(
        "resume remains bound to V1 after V2 publication",
        async () => {
          installMocks();

          const started = await runStart();

          assert.equal(started.statusCode, 201);
          assert.equal(createdAttempts.length, 1);

          const originalVersion = version;

          const originalAttemptVersionId =
            currentAttempt.mockTestVersionId;

          const originalWindows = JSON.stringify(
            currentAttempt.timingState.sectionWindows
          );

          const v2Id = "507f1f77bcf86cd799439016";

          const versionV2 = {
            ...makeVersion(),
            _id: v2Id,
            versionNumber: 2,
            title: "New Published V2",
          };

          MockTest.findOne = () => queryResult(() => ({
            _id: IDS.test,
            tenantId,
            activeVersionId: v2Id,
            isActive: true,
            isPublished: true,
            accessType: "free",
          }));

          const lookups = [];

          MockTestVersion.findOne = (query) => queryResult(() => {
            lookups.push(query);

            if (
              query.tenantId !== tenantId ||
              (String(query._id) === IDS.version && String(query.mockTestId) !== IDS.test) ||
              query.isActive !== true
            ) {
              return null;
            }

            if (String(query._id) === IDS.version) {
              return originalVersion;
            }

            if (String(query._id) === v2Id) {
              return versionV2;
            }

            return null;
          });

          const resumed = await runStart();

          assert.equal(resumed.statusCode, 200);
          assert.equal(resumed.body.success, true);
          assert.equal(resumed.body.data.resumed, true);

          assert.equal(
            String(resumed.body.data.test._id),
            IDS.version
          );

          assert.equal(
            resumed.body.data.test.versionNumber,
            1
          );

          assert.equal(
            resumed.body.data.test.title,
            "Timing Runtime Contract"
          );

          assert.equal(
            String(currentAttempt.mockTestVersionId),
            String(originalAttemptVersionId)
          );

          assert.equal(
            JSON.stringify(
              currentAttempt.timingState.sectionWindows
            ),
            originalWindows
          );

          assert.equal(createdAttempts.length, 1);
          assert.equal(createdDetails.length, 1);
          assert.equal(attemptSaveCalls, 1);

          assert.ok(
            lookups.some((query) =>
              String(query._id) === IDS.version &&
              query.tenantId === tenantId &&
              String(query.mockTestId) === IDS.test &&
              query.isActive === true
            )
          );

          assert.equal(
            lookups.some((query) =>
              String(query._id) === v2Id
            ),
            true
          );
        }
      );

      await t.test(
        "unavailable historical V1 cannot fall back to V2",
        async () => {
          installMocks();

          const started = await runStart();

          assert.equal(started.statusCode, 201);

          const originalWindows = JSON.stringify(
            currentAttempt.timingState.sectionWindows
          );

          const v2Id = "507f1f77bcf86cd799439016";

          MockTest.findOne = () => queryResult(() => ({
            _id: IDS.test,
            tenantId,
            activeVersionId: v2Id,
            isActive: true,
            isPublished: true,
            accessType: "free",
          }));

          const lookups = [];

          MockTestVersion.findOne = (query) => queryResult(() => {
            lookups.push(query);

            if (
              query.tenantId !== tenantId ||
              (String(query._id) === IDS.version && String(query.mockTestId) !== IDS.test) ||
              query.isActive !== true
            ) {
              return null;
            }

            if (String(query._id) === IDS.version) {
              return null;
            }

            if (String(query._id) === v2Id) {
              return {
                ...makeVersion(),
                _id: v2Id,
                versionNumber: 2,
              };
            }

            return null;
          });

          const resumed = await runStart();

          assert.equal(resumed.statusCode, 404);
          assert.equal(resumed.body.success, false);

          assert.equal(createdAttempts.length, 1);
          assert.equal(createdDetails.length, 1);

          assert.equal(attemptSaveCalls, 0);

          assert.equal(
            JSON.stringify(
              currentAttempt.timingState.sectionWindows
            ),
            originalWindows
          );

          assert.ok(
            lookups.some((query) =>
              String(query._id) === IDS.version &&
              query.tenantId === tenantId &&
              String(query.mockTestId) === IDS.test &&
              query.isActive === true
            )
          );
        }
      );
    } finally {
      restoreMocks();
    }
  }
);
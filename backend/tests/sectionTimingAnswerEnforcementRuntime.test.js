"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const MockTestVersion = require("../src/models/MockTestVersion");
const TestAttempt = require("../src/models/TestAttempt");
const TestAttemptDetail = require("../src/models/TestAttemptDetail");

const {
  saveMockTestAnswer,
} = require("../src/controllers/studentMockTestController");

const IDS = {
  student: "507f1f77bcf86cd799439011",
  test: "507f1f77bcf86cd799439012",
  version: "507f1f77bcf86cd799439013",
  attempt: "507f1f77bcf86cd799439014",
  detail: "507f1f77bcf86cd799439015",
  reasoning: "507f1f77bcf86cd799439021",
  maths: "507f1f77bcf86cd799439022",
};

const tenantId = "pravixoedutech";

const originals = {
  startSession: mongoose.startSession,
  versionFind: MockTestVersion.findOne,
  attemptFind: TestAttempt.findOne,
  detailFind: TestAttemptDetail.findOne,
  detailCreate: TestAttemptDetail.create,
};

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

const question = (_id) => ({
  _id,
  options: [
    { optionId: "A" },
    { optionId: "B" },
  ],
  marks: 1,
  negativeMarks: 0,
});

const makeVersion = () => ({
  _id: IDS.version,
  mockTestId: IDS.test,
  sections: [
    {
      sectionSlug: "reasoning",
      order: 1,
      durationMinutes: 10,
      questions: [question(IDS.reasoning)],
    },
    {
      sectionSlug: "maths",
      order: 2,
      durationMinutes: 20,
      questions: [question(IDS.maths)],
    },
  ],
});

const answerFor = (id, sectionSlug) => ({
  sectionSlug,
  questionId: id,
  questionSnapshotId: id,
  questionOrder: 1,
  selectedOptionId: undefined,
  markedForReview: false,
  confidenceLevel: "not_marked",
  visited: false,
  timeSpentSeconds: 0,
  status: "not_visited",
  answeredAt: null,
});

const buildFixture = ({
  mode = "sectional",
  active = "reasoning",
  expired = false,
  delayVersionMs = 0,
  firstSectionExpiresInMs = null,
} = {}) => {
  const base = Date.now();

  let firstStart;
  let firstEnd;
  let finalEnd;

  if (firstSectionExpiresInMs !== null) {
    firstEnd = base + firstSectionExpiresInMs;
    firstStart = firstEnd - 10 * 60 * 1000;
    finalEnd = firstEnd + 20 * 60 * 1000;
  } else if (active === "maths") {
    firstStart = base - 12 * 60 * 1000;
    firstEnd = base - 2 * 60 * 1000;
    finalEnd = base + 18 * 60 * 1000;
  } else {
    firstStart = base - 2 * 60 * 1000;
    firstEnd = base + 8 * 60 * 1000;
    finalEnd = base + 28 * 60 * 1000;
  }

  if (expired) {
    firstStart = base - 31 * 60 * 1000;
    firstEnd = base - 21 * 60 * 1000;
    finalEnd = base - 60 * 1000;
  }

  const timingState =
    mode === "sectional"
      ? {
          mode: "sectional",
          policyVersion: 1,
          sectionWindows: [
            {
              sectionSlug: "reasoning",
              order: 1,
              startsAt: new Date(firstStart),
              expiresAt: new Date(firstEnd),
            },
            {
              sectionSlug: "maths",
              order: 2,
              startsAt: new Date(firstEnd),
              expiresAt: new Date(finalEnd),
            },
          ],
        }
      : mode === "global"
        ? {
            mode: "global",
            policyVersion: 1,
            sectionWindows: [],
          }
        : undefined;

  const attempt = {
    _id: IDS.attempt,
    tenantId,
    studentId: IDS.student,
    mockTestId: IDS.test,
    mockTestVersionId: IDS.version,
    isActive: true,
    status: "in_progress",
    startedAt: new Date(firstStart),
    expiresAt: new Date(finalEnd),
    totalDurationSeconds: 1800,
    timeSpentSeconds: 0,
    lastActivityAt: new Date(firstStart),
    ...(timingState ? { timingState } : {}),
  };

  const detail = {
    _id: IDS.detail,
    tenantId,
    attemptId: IDS.attempt,
    studentId: IDS.student,
    mockTestId: IDS.test,
    mockTestVersionId: IDS.version,
    expiresAt: new Date(finalEnd + 86400000),
    answers: [
      answerFor(IDS.reasoning, "reasoning"),
      answerFor(IDS.maths, "maths"),
    ],
    lastSyncedAt: null,
  };

  const counters = {
    attemptSave: 0,
    detailSave: 0,
    detailCreate: 0,
    detailFind: 0,
    detailMarkModified: 0,
    versionFind: 0,
    sessionStarts: 0,
    transactionCallbacks: 0,
    sessionEnds: 0,
    sessionQueries: 0,
  };

  attempt.save = async function () {
    counters.attemptSave += 1;
    return this;
  };

  detail.save = async function () {
    counters.detailSave += 1;
    return this;
  };

  detail.markModified = function (path) {
    assert.equal(path, "answers");
    counters.detailMarkModified += 1;
  };

  const fixtureSession = {
    async withTransaction(callback) {
      counters.transactionCallbacks += 1;
      return callback();
    },
    async endSession() {
      counters.sessionEnds += 1;
    },
  };

  mongoose.startSession = async () => {
    counters.sessionStarts += 1;
    return fixtureSession;
  };

  const asSessionQuery = (document) => {
    const query = Promise.resolve(document);

    query.session = (session) => {
      assert.equal(
        session,
        fixtureSession,
        "Query must use its owning test session"
      );
      counters.sessionQueries += 1;
      return query;
    };

    return query;
  };

  MockTestVersion.findOne = async (query) => {
    counters.versionFind += 1;

    assert.equal(String(query._id), IDS.version);
    assert.equal(query.tenantId, tenantId);
    assert.equal(query.isActive, true);

    if (delayVersionMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, delayVersionMs)
      );
    }

    return makeVersion();
  };

  TestAttempt.findOne = (query) => {
    assert.equal(String(query._id), IDS.attempt);
    assert.equal(query.tenantId, tenantId);
    assert.equal(String(query.studentId), IDS.student);
    assert.equal(query.isActive, true);

    return asSessionQuery(attempt);
  };

  TestAttemptDetail.findOne = (query) => {
    counters.detailFind += 1;
    assert.equal(query.tenantId, tenantId);
    assert.equal(String(query.attemptId), IDS.attempt);

    return asSessionQuery(detail);
  };

  TestAttemptDetail.create = async () => {
    counters.detailCreate += 1;
    throw new Error("Unexpected attempt-detail creation");
  };

  return { attempt, detail, counters };
};

const restoreMocks = () => {
  mongoose.startSession = originals.startSession;
  MockTestVersion.findOne = originals.versionFind;
  TestAttempt.findOne = originals.attemptFind;
  TestAttemptDetail.findOne = originals.detailFind;
  TestAttemptDetail.create = originals.detailCreate;
};

const runAnswer = async ({
  questionSnapshotId = IDS.reasoning,
  body = {},
} = {}) => {
  const req = {
    user: {
      _id: IDS.student,
      tenantId,
      role: "student",
    },
    params: {
      attemptId: IDS.attempt,
    },
    body: {
      questionSnapshotId,
      ...body,
    },
  };

  const res = makeResponse();
  await saveMockTestAnswer(req, res);
  return res;
};

const withFixture = async (options, fn) => {
  const fixture = buildFixture(options);

  try {
    await fn(fixture);
  } finally {
    restoreMocks();
  }
};

test(
  "B4 harness supports session-aware attempt and detail queries",
  { concurrency: false },
  async () => {
    await withFixture({}, async ({ attempt, detail, counters }) => {
      const session = await mongoose.startSession();

      await session.withTransaction(async () => {
        const loadedAttempt = await TestAttempt.findOne({
          _id: IDS.attempt,
          tenantId,
          studentId: IDS.student,
          isActive: true,
        }).session(session);

        const loadedDetail = await TestAttemptDetail.findOne({
          tenantId,
          attemptId: IDS.attempt,
        }).session(session);

        assert.equal(loadedAttempt, attempt);
        assert.equal(loadedDetail, detail);
      });

      await session.endSession();

      assert.equal(counters.sessionStarts, 1);
      assert.equal(counters.transactionCallbacks, 1);
      assert.equal(counters.sessionQueries, 2);
      assert.equal(counters.sessionEnds, 1);

      console.log("SESSION_AWARE_MOCK_COMPATIBILITY_PASS=True");
    });
  }
);

test(
  "B4 permits valid answer in active reasoning section",
  { concurrency: false },
  async () => {
    await withFixture({}, async ({ detail, counters }) => {
      const res = await runAnswer({
        body: { selectedOptionId: "A" },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(detail.answers[0].selectedOptionId, "A");
      assert.equal(counters.detailSave, 1);
      assert.equal(counters.attemptSave, 1);
    });
  }
);

test(
  "B4 rejects future maths section without answer mutation",
  { concurrency: false },
  async () => {
    await withFixture({}, async ({ detail, counters }) => {
      const before = JSON.stringify(detail.answers);

      const res = await runAnswer({
        questionSnapshotId: IDS.maths,
        body: {
          selectedOptionId: "B",
          markedForReview: true,
          confidenceLevel: "sure",
          timeSpentSeconds: 50,
        },
      });

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.success, false);
      assert.equal(JSON.stringify(detail.answers), before);
      assert.equal(counters.detailFind, 0);
      assert.equal(counters.detailSave, 0);
      assert.equal(counters.attemptSave, 0);
    });
  }
);

test(
  "B4 permits maths section after reasoning window ends",
  { concurrency: false },
  async () => {
    await withFixture(
      { active: "maths" },
      async ({ detail, counters }) => {
        const res = await runAnswer({
          questionSnapshotId: IDS.maths,
          body: { selectedOptionId: "B" },
        });

        assert.equal(res.statusCode, 200);
        assert.equal(detail.answers[1].selectedOptionId, "B");
        assert.equal(counters.detailSave, 1);
      }
    );
  }
);

test(
  "B4 rejects expired reasoning after maths activates",
  { concurrency: false },
  async () => {
    await withFixture(
      { active: "maths" },
      async ({ detail, counters }) => {
        detail.answers[0].selectedOptionId = "A";
        const before = JSON.stringify(detail.answers);

        const res = await runAnswer({
          questionSnapshotId: IDS.reasoning,
          body: { selectedOptionId: null },
        });

        assert.equal(res.statusCode, 403);
        assert.equal(JSON.stringify(detail.answers), before);
        assert.equal(counters.detailFind, 0);
        assert.equal(counters.detailSave, 0);
      }
    );
  }
);

test(
  "B4 permits answer clearing and review changes within active section",
  { concurrency: false },
  async () => {
    await withFixture({}, async ({ detail }) => {
      detail.answers[0].selectedOptionId = "A";

      const res = await runAnswer({
        body: {
          selectedOptionId: null,
          markedForReview: true,
          confidenceLevel: "doubtful",
          timeSpentSeconds: 9,
        },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(detail.answers[0].selectedOptionId, undefined);
      assert.equal(detail.answers[0].markedForReview, true);
      assert.equal(detail.answers[0].confidenceLevel, "doubtful");
      assert.equal(detail.answers[0].timeSpentSeconds, 9);
    });
  }
);

test(
  "B4 global mode allows navigation across both sections",
  { concurrency: false },
  async () => {
    await withFixture(
      { mode: "global" },
      async ({ detail }) => {
        const res = await runAnswer({
          questionSnapshotId: IDS.maths,
          body: { selectedOptionId: "A" },
        });

        assert.equal(res.statusCode, 200);
        assert.equal(detail.answers[1].selectedOptionId, "A");
      }
    );
  }
);

test(
  "B4 legacy attempt without timingState retains global behavior",
  { concurrency: false },
  async () => {
    await withFixture(
      { mode: "legacy" },
      async ({ attempt, detail }) => {
        const res = await runAnswer({
          questionSnapshotId: IDS.maths,
          body: { selectedOptionId: "B" },
        });

        assert.equal(res.statusCode, 200);
        assert.equal(detail.answers[1].selectedOptionId, "B");
        assert.equal(
          Object.hasOwn(attempt, "timingState"),
          false
        );
      }
    );
  }
);

test(
  "B4 final expiry rejects writes before detail access",
  { concurrency: false },
  async () => {
    await withFixture(
      { expired: true },
      async ({ attempt, detail, counters }) => {
        const before = JSON.stringify(detail.answers);

        const res = await runAnswer({
          body: { selectedOptionId: "A" },
        });

        assert.equal(res.statusCode, 403);
        assert.equal(attempt.status, "expired");
        assert.equal(counters.attemptSave, 1);
        assert.equal(counters.detailFind, 0);
        assert.equal(counters.detailSave, 0);
        assert.equal(JSON.stringify(detail.answers), before);
      }
    );
  }
);

test(
  "B4 rejects unknown question without accessing answers",
  { concurrency: false },
  async () => {
    await withFixture({}, async ({ counters }) => {
      const res = await runAnswer({
        questionSnapshotId: "507f1f77bcf86cd799439099",
        body: { selectedOptionId: "A" },
      });

      assert.equal(res.statusCode, 404);
      assert.equal(counters.detailFind, 0);
      assert.equal(counters.detailSave, 0);
    });
  }
);

test(
  "B4 delayed lookup must not authorize an already expired section",
  { concurrency: false },
  async () => {
    await withFixture(
      {
        firstSectionExpiresInMs: 70,
        delayVersionMs: 180,
      },
      async ({ detail, counters }) => {
        const before = JSON.stringify(detail.answers);

        const res = await runAnswer({
          questionSnapshotId: IDS.reasoning,
          body: { selectedOptionId: "A" },
        });

        assert.equal(
          res.statusCode,
          403,
          "A delayed request must not write after its section expires"
        );

        assert.equal(JSON.stringify(detail.answers), before);
        assert.equal(counters.detailSave, 0);
        assert.equal(counters.attemptSave, 0);
      }
    );
  }
);
test(
  "B4 transaction: detail save failure closes session and denies success",
  { concurrency: false },
  async () => {
    await withFixture({}, async ({ attempt, detail, counters }) => {
      detail.save = async function () {
        counters.detailSave += 1;
        throw new Error("B4_INJECTED_DETAIL_SAVE_FAILURE");
      };

      const response = await runAnswer({
        body: { selectedOptionId: "A" },
      });

      assert.equal(response.statusCode, 500);
      assert.equal(response.body.success, false);

      assert.equal(counters.sessionStarts, 1);
      assert.equal(counters.transactionCallbacks, 1);
      assert.equal(counters.sessionEnds, 1);

      assert.equal(counters.detailSave, 1);
      assert.equal(counters.attemptSave, 0);

      assert.equal(attempt.status, "in_progress");

      console.log("DETAIL_FAILURE_NO_HTTP_SUCCESS=True");
      console.log("DETAIL_FAILURE_SESSION_CLOSED=True");
    });
  }
);

test(
  "B4 transaction: attempt save failure closes session and denies success",
  { concurrency: false },
  async () => {
    await withFixture({}, async ({ attempt, counters }) => {
      attempt.save = async function () {
        counters.attemptSave += 1;
        throw new Error("B4_INJECTED_ATTEMPT_SAVE_FAILURE");
      };

      const response = await runAnswer({
        body: { selectedOptionId: "A" },
      });

      assert.equal(response.statusCode, 500);
      assert.equal(response.body.success, false);

      assert.equal(counters.sessionStarts, 1);
      assert.equal(counters.transactionCallbacks, 1);
      assert.equal(counters.sessionEnds, 1);

      assert.equal(counters.detailSave, 1);
      assert.equal(counters.attemptSave, 1);

      assert.equal(attempt.status, "in_progress");

      // The fake session does not roll back detail mutations.
      // Only a real DB integration test can establish atomicity.
      console.log("ATTEMPT_FAILURE_NO_HTTP_SUCCESS=True");
      console.log("ATTEMPT_FAILURE_SESSION_CLOSED=True");
      console.log("MOCK_ROLLBACK_NOT_ASSERTED=True");
    });
  }
);
test(
  "B4 transaction: exhausted MongoDB write conflict returns 409",
  { concurrency: false },
  async () => {
    await withFixture({}, async ({ attempt, detail, counters }) => {
      detail.save = async function () {
        counters.detailSave += 1;

        const error = new Error("B4_INJECTED_WRITE_CONFLICT");
        error.code = 112;
        error.codeName = "WriteConflict";

        // The session mock does not automatically retry.
        // This fixture models a conflict propagated to the
        // handler after transaction retries are exhausted.
        throw error;
      };

      const response = await runAnswer({
        body: { selectedOptionId: "A" },
      });

      assert.equal(
        response.statusCode,
        409,
        "A MongoDB write conflict must produce HTTP 409"
      );

      assert.equal(response.body.success, false);
      assert.equal(counters.sessionStarts, 1);
      assert.equal(counters.sessionEnds, 1);
      assert.equal(counters.detailSave, 1);
      assert.equal(counters.attemptSave, 0);
      assert.equal(attempt.status, "in_progress");

      console.log("MONGODB_WRITE_CONFLICT_HTTP_409=True");
      console.log("MONGODB_WRITE_CONFLICT_SESSION_CLOSED=True");
    });
  }
);
test(
  "B4 transaction: retry rechecks expired section",
  { concurrency: false },
  async () => {
    await withFixture(
      { firstSectionExpiresInMs: 200 },
      async ({ detail, counters }) => {
        const originalMockStartSession = mongoose.startSession;
        const originalMockVersionFind = MockTestVersion.findOne;

        let callbacks = 0;
        let injectedConflicts = 0;

        // Simulate a transient conflict during the first pass.
        // The fake transaction retries after the first
        // section's absolute deadline.
        MockTestVersion.findOne = async (query) => {
          if (injectedConflicts === 0) {
            injectedConflicts += 1;

            const conflict = new Error("SIMULATED_TRANSIENT_CONFLICT");
            conflict.code = 112;
            conflict.codeName = "WriteConflict";
            conflict.errorLabels = ["TransientTransactionError"];
            throw conflict;
          }

          return originalMockVersionFind(query);
        };

        mongoose.startSession = async () => {
          const session = await originalMockStartSession();

          session.withTransaction = async (callback) => {
            while (callbacks < 2) {
              callbacks += 1;
              counters.transactionCallbacks += 1;

              try {
                return await callback();
              } catch (error) {
                if (
                  callbacks !== 1 ||
                  !error.errorLabels?.includes("TransientTransactionError")
                ) {
                  throw error;
                }

                // Advance past the real absolute deadline.
                await new Promise((resolve) => setTimeout(resolve, 300));
              }
            }

            throw new Error("Unexpected transaction retry count");
          };

          return session;
        };

        try {
          const response = await runAnswer({
            body: { selectedOptionId: "A" },
          });

          assert.equal(injectedConflicts, 1);
          assert.equal(callbacks, 2);
          assert.equal(response.statusCode, 403);
          assert.equal(response.body.success, false);

          // No answer mutation may be persisted after retry.
          assert.equal(detail.answers[0].selectedOptionId, undefined);
          assert.equal(counters.detailSave, 0);
          assert.equal(counters.sessionStarts, 1);
          assert.equal(counters.sessionEnds, 1);

          console.log("RETRY_SECTION_DEADLINE_RECHECK_PASS=True");
          console.log("RETRY_ANSWER_WRITES=0");
          console.log("RETRY_HTTP_STATUS=403");
        } finally {
          mongoose.startSession = originalMockStartSession;
          MockTestVersion.findOne = originalMockVersionFind;
        }
      }
    );
  }
);

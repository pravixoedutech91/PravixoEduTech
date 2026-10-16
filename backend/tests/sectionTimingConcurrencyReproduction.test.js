"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const MockTestVersion = require("../src/models/MockTestVersion");
const TestAttempt = require("../src/models/TestAttempt");
const TestAttemptDetail = require("../src/models/TestAttemptDetail");

const {
  saveMockTestAnswer,
  submitMockTestAttempt,
} = require("../src/controllers/studentMockTestController");

const ids = {
  student: "507f1f77bcf86cd799439011",
  mockTest: "507f1f77bcf86cd799439012",
  version: "507f1f77bcf86cd799439013",
  attempt: "507f1f77bcf86cd799439014",
  detail: "507f1f77bcf86cd799439015",
  reasoning: "507f1f77bcf86cd799439021",
  maths: "507f1f77bcf86cd799439022",
};

const tenantId = "pravixoedutech";

const original = {
  startSession: mongoose.startSession,
  versionFind: MockTestVersion.findOne,
  attemptFind: TestAttempt.findOne,
  detailFind: TestAttemptDetail.findOne,
  detailCreate: TestAttemptDetail.create,
};

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const activeMockSessions = new Set();

function installSessionMocks() {
  mongoose.startSession = async () => {
    const session = {
      async withTransaction(callback) {
        return callback();
      },
      async endSession() {
        activeMockSessions.delete(session);
      },
    };

    activeMockSessions.add(session);
    return session;
  };
}

function asSessionQuery(valueOrPromise) {
  const query = Promise.resolve(valueOrPromise);

  query.session = (session) => {
    assert.ok(
      activeMockSessions.has(session),
      "Query must use an active mock session"
    );

    return query;
  };

  return query;
}

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(value) {
    this.body = value;
    return this;
  },
});

const version = {
  _id: ids.version,
  mockTestId: ids.mockTest,
  accessType: "free",
  testType: "mock",
  settings: {
    solutionVisibility: "after_submit",
  },
  examPatternSnapshot: {
    timingMode: "global",
    totalDurationMinutes: 30,
  },
  sections: [
    {
      sectionSlug: "reasoning",
      name: "Reasoning",
      sectionType: "reasoning",
      order: 1,
      questions: [
        {
          _id: ids.reasoning,
          questionId: ids.reasoning,
          marks: 1,
          negativeMarks: 0,
          correctOptionId: "A",
          options: [{ optionId: "A" }, { optionId: "B" }],
        },
      ],
    },
    {
      sectionSlug: "maths",
      name: "Maths",
      sectionType: "maths",
      order: 2,
      questions: [
        {
          _id: ids.maths,
          questionId: ids.maths,
          marks: 1,
          negativeMarks: 0,
          correctOptionId: "B",
          options: [{ optionId: "A" }, { optionId: "B" }],
        },
      ],
    },
  ],
};

const answer = (id, section) => ({
  sectionSlug: section,
  questionId: id,
  questionSnapshotId: id,
  questionOrder: 1,
  selectedOptionId: null,
  markedForReview: false,
  confidenceLevel: "not_marked",
  visited: false,
  timeSpentSeconds: 0,
  status: "not_visited",
  answeredAt: null,
});

const initialDetail = () => ({
  _id: ids.detail,
  __v: 0,
  tenantId,
  attemptId: ids.attempt,
  studentId: ids.student,
  mockTestId: ids.mockTest,
  mockTestVersionId: ids.version,
  answers: [
    answer(ids.reasoning, "reasoning"),
    answer(ids.maths, "maths"),
  ],
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
});

const initialAttempt = () => ({
  _id: ids.attempt,
  tenantId,
  studentId: ids.student,
  mockTestId: ids.mockTest,
  mockTestVersionId: ids.version,
  status: "in_progress",
  isActive: true,
  startedAt: new Date(Date.now() - 60000).toISOString(),
  expiresAt: new Date(Date.now() + 1800000).toISOString(),
  totalDurationSeconds: 1800,
  timeSpentSeconds: 0,
  review: { reviewRetentionDays: 7 },
});

const request = (kind, questionId, optionId) => ({
  user: {
    _id: ids.student,
    tenantId,
    role: "student",
  },
  params: { attemptId: ids.attempt },
  body: kind === "answer"
    ? {
        questionSnapshotId: questionId,
        selectedOptionId: optionId,
      }
    : {},
});

async function run(kind, questionId, optionId) {
  const res = response();
  const req = request(kind, questionId, optionId);

  if (kind === "submit") {
    await submitMockTestAttempt(req, res);
  } else {
    await saveMockTestAnswer(req, res);
  }

  return res;
}

function installRace({ submission = false } = {}) {
  installSessionMocks();

  const state = {
    persistedDetail: initialDetail(),
    persistedAttempt: initialAttempt(),
    reads: 0,
    saves: 0,
    events: [],
  };

  function persistDetail(doc) {
    if (doc.__v !== state.persistedDetail.__v) {
      const error = new Error(
        "No matching document found for version " + doc.__v
      );
      error.name = "VersionError";
      throw error;
    }

    const next = clone(doc);
    next.__v = doc.__v + 1;
    state.persistedDetail = next;
    doc.__v = next.__v;
  }

  const bothRead = deferred();
  const firstSaved = deferred();

  MockTestVersion.findOne = async (query) => {
    assert.equal(String(query._id), ids.version);
    assert.equal(query.tenantId, tenantId);
    return version;
  };

  TestAttempt.findOne = (query) => {
    assert.equal(String(query._id), ids.attempt);
    assert.equal(query.tenantId, tenantId);
    assert.equal(String(query.studentId), ids.student);

    const doc = clone(state.persistedAttempt);

    doc.save = async function () {
      state.persistedAttempt = clone({
        ...this,
        save: undefined,
      });
      state.events.push("attempt-save");
      return this;
    };

    return asSessionQuery(doc);
  };

  TestAttemptDetail.findOne = (query) => {
    const work = (async () => {
      assert.equal(query.tenantId, tenantId);
      assert.equal(String(query.attemptId), ids.attempt);

      // Preserve the original submit/answer classification.
      const kind = query.studentId ? "submit" : "answer";

      const doc = clone(state.persistedDetail);
      doc.markModified = () => {};

    doc.save = async function () {
      state.saves += 1;
      const saveNumber = state.saves;

      if (submission) {
        if (kind === "submit") {
          state.events.push("submit-save-wait");
          await firstSaved.promise;
        } else {
          state.events.push("answer-save");
          persistDetail(this);
          firstSaved.resolve();
          return this;
        }
      } else if (saveNumber === 1) {
        state.events.push("first-save-wait");
        await firstSaved.promise;
      } else {
        state.events.push("second-save");
        persistDetail(this);
        firstSaved.resolve();
        return this;
      }

      state.events.push("last-save");
      persistDetail(this);
      return this;
    };

    state.reads += 1;
    state.events.push(kind + "-read");

    // Both callers must obtain independent stale copies
    // before either is allowed to mutate and save.
    if (state.reads === 2) {
      bothRead.resolve();
    }

      await bothRead.promise;
      return doc;
    })();

    return asSessionQuery(work);
  };

  TestAttemptDetail.create = async () => {
    throw new Error("Unexpected detail creation");
  };

  return state;
}

function restore() {
  mongoose.startSession = original.startSession;
  activeMockSessions.clear();
  MockTestVersion.findOne = original.versionFind;
  TestAttempt.findOne = original.attemptFind;
  TestAttemptDetail.findOne = original.detailFind;
  TestAttemptDetail.create = original.detailCreate;
}

test(
  "B4 OCC: simultaneous answers reject a stale document save",
  { concurrency: false },
  async () => {
    const state = installRace();

    try {
      const outcomes = await Promise.all([
        run("answer", ids.reasoning, "A"),
        run("answer", ids.maths, "B"),
      ]);

      assert.deepEqual(
        outcomes.map((result) => result.statusCode),
        [409, 200]
      );

      const persisted = state.persistedDetail.answers;
      const saved = persisted.filter(
        (item) => Boolean(item.selectedOptionId)
      );

      // The stale request must fail without removing the
      // answer saved by the successful concurrent request.
      assert.equal(saved.length, 1);
      assert.equal(
        String(saved[0].questionSnapshotId),
        ids.maths
      );
      assert.equal(saved[0].selectedOptionId, "B");

      const reasoning = persisted.find(
        (item) =>
          String(item.questionSnapshotId) === ids.reasoning
      );

      assert.equal(reasoning.selectedOptionId, null);
      assert.equal(state.reads, 2);
      assert.equal(state.saves, 2);
      assert.equal(state.persistedDetail.__v, 1);

      console.log("OCC_CONCURRENT_ANSWERS_PASS=True");
      console.log("STALE_ANSWER_HTTP=409");
      console.log("SAVED_ANSWER_HTTP=200");
      console.log("PERSISTED_MATHS_OPTION=B");
    } finally {
      restore();
    }
  }
);

test(
  "B4 OCC: submission rejects stale detail after answer save",
  { concurrency: false },
  async () => {
    const state = installRace({ submission: true });

    try {
      const outcomes = await Promise.all([
        run("submit"),
        run("answer", ids.reasoning, "A"),
      ]);

      assert.deepEqual(
        outcomes.map((result) => result.statusCode),
        [409, 200]
      );

      const storedAnswer = state.persistedDetail.answers.find(
        (item) =>
          String(item.questionSnapshotId) === ids.reasoning
      );

      assert.equal(storedAnswer.selectedOptionId, "A");
      assert.equal(state.persistedDetail.__v, 1);
      assert.equal(
        state.persistedAttempt.status,
        "in_progress"
      );

      console.log("OCC_SUBMISSION_CONFLICT_PASS=True");
      console.log("STALE_SUBMISSION_HTTP=409");
      console.log("SAVED_ANSWER_HTTP=200");
      console.log("PERSISTED_REASONING_OPTION=A");
    } finally {
      restore();
    }
  }
);
test(
  "B4 security: a stale answer request must not save after submission",
  { concurrency: false },
  async () => {
    const state = {
      persistedAttempt: initialAttempt(),
      persistedDetail: {
        ...initialDetail(),
        __v: 0,
      },
      detailSaves: 0,
      versionCalls: 0,
    };

    installSessionMocks();

    const answerVersionReached = deferred();
    const releaseAnswerVersion = deferred();

    MockTestVersion.findOne = async (query) => {
      assert.equal(String(query._id), ids.version);

      state.versionCalls += 1;

      if (state.versionCalls === 1) {
        answerVersionReached.resolve();
        await releaseAnswerVersion.promise;
      }

      return version;
    };

    TestAttempt.findOne = (query) => {
      assert.equal(String(query._id), ids.attempt);

      const doc = clone(state.persistedAttempt);

      doc.save = async function () {
        if (this.status === "submitted") {
          state.persistedAttempt = clone(this);
        } else {
          // Reflect Mongoose's changed-path save behavior:
          // an activity update should not restore a submitted
          // attempt to in_progress.
          state.persistedAttempt.lastActivityAt =
            this.lastActivityAt;
          state.persistedAttempt.timeSpentSeconds =
            this.timeSpentSeconds;
        }

        return this;
      };

      return asSessionQuery(doc);
    };

    TestAttemptDetail.findOne = (query) => {
      assert.equal(query.tenantId, tenantId);

      const doc = clone(state.persistedDetail);

      doc.markModified = () => {};

      doc.save = async function () {
        if (this.__v !== state.persistedDetail.__v) {
          const error = new Error("Stale detail version");
          error.name = "VersionError";
          throw error;
        }

        const next = clone(this);
        next.__v = this.__v + 1;

        state.persistedDetail = next;
        state.detailSaves += 1;

        this.__v = next.__v;
        return this;
      };

      return asSessionQuery(doc);
    };

    TestAttemptDetail.create = async () => {
      throw new Error("Unexpected detail creation");
    };

    try {
      const delayedAnswer = run(
        "answer",
        ids.reasoning,
        "A"
      );

      await answerVersionReached.promise;

      const submitted = await run("submit");

      assert.equal(
        submitted.statusCode,
        200,
        "Submission fixture must complete successfully"
      );

      assert.equal(
        state.persistedAttempt.status,
        "submitted"
      );

      const submissionSaves = state.detailSaves;

      releaseAnswerVersion.resolve();

      const lateAnswer = await delayedAnswer;

      const savedAnswer =
        state.persistedDetail.answers.find(
          (item) =>
            String(item.questionSnapshotId) === ids.reasoning
        );

      // Security expectation: a request that loaded an
      // old in_progress state must not mutate a test
      // that has already been submitted.
      assert.equal(
        lateAnswer.statusCode,
        403,
        "A submitted attempt must reject late answer writes"
      );

      assert.equal(
        state.detailSaves,
        submissionSaves,
        "Late answer must not write to detail"
      );

      assert.equal(
        savedAnswer.selectedOptionId,
        null,
        "Submitted answers must remain unchanged"
      );

      assert.equal(
        state.persistedAttempt.status,
        "submitted"
      );

      console.log(
        "POST_SUBMISSION_ANSWER_REJECTED=True"
      );
    } finally {
      releaseAnswerVersion.resolve();
      restore();
    }
  }
);
test(
  "B4 transaction: duplicate final submission cannot overwrite result",
  { concurrency: false },
  async () => {
    installSessionMocks();

    const state = {
      attempt: initialAttempt(),
      detail: initialDetail(),
      attemptSaves: 0,
      detailSaves: 0,
      versionReads: 0,
    };

    MockTestVersion.findOne = async (query) => {
      assert.equal(String(query._id), ids.version);
      assert.equal(query.tenantId, tenantId);
      state.versionReads += 1;
      return version;
    };

    TestAttempt.findOne = (query) => {
      assert.equal(String(query._id), ids.attempt);
      assert.equal(query.tenantId, tenantId);
      assert.equal(String(query.studentId), ids.student);

      const doc = clone(state.attempt);

      doc.save = async function (options) {
        assert.ok(
          activeMockSessions.has(options?.session),
          "Attempt save must use an active transaction session"
        );

        state.attemptSaves += 1;

        const persisted = clone(this);
        delete persisted.save;
        state.attempt = persisted;

        return this;
      };

      return asSessionQuery(doc);
    };

    TestAttemptDetail.findOne = (query) => {
      assert.equal(query.tenantId, tenantId);
      assert.equal(String(query.attemptId), ids.attempt);

      const doc = clone(state.detail);

      doc.markModified = (path) => {
        assert.equal(path, "answers");
      };

      doc.save = async function (options) {
        assert.ok(
          activeMockSessions.has(options?.session),
          "Detail save must use an active transaction session"
        );

        state.detailSaves += 1;

        const persisted = clone(this);
        delete persisted.save;
        delete persisted.markModified;
        state.detail = persisted;

        return this;
      };

      return asSessionQuery(doc);
    };

    TestAttemptDetail.create = async () => {
      throw new Error("Unexpected detail creation");
    };

    try {
      const first = await run("submit");

      assert.equal(first.statusCode, 200);
      assert.equal(first.body.success, true);
      assert.equal(state.attempt.status, "submitted");
      assert.equal(state.attemptSaves, 1);
      assert.equal(state.detailSaves, 1);

      const finalized = clone(state.attempt);
      const finalizedDetail = clone(state.detail);

      const second = await run("submit");

      assert.equal(
        second.statusCode,
        400,
        "Second submission must not succeed"
      );
      assert.equal(second.body.success, false);

      assert.equal(state.attemptSaves, 1);
      assert.equal(state.detailSaves, 1);

      assert.deepEqual(
        state.attempt,
        finalized,
        "Duplicate submission must not change permanent result"
      );
      assert.deepEqual(
        state.detail,
        finalizedDetail,
        "Duplicate submission must not change saved answers"
      );

      assert.equal(
        activeMockSessions.size,
        0,
        "Both transaction sessions must be closed"
      );

      console.log("FIRST_SUBMISSION_HTTP=200");
      console.log("DUPLICATE_SUBMISSION_HTTP=400");
      console.log("DUPLICATE_ADDITIONAL_WRITES=0");
      console.log("FINALIZED_RESULT_UNCHANGED=True");
    } finally {
      restore();
    }
  }
);

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const controllerSource = fs.readFileSync(
  path.join(
    __dirname,
    "../src/controllers/studentMockTestController.js"
  ),
  "utf8"
);

function handler(startMarker, endMarker) {
  const start = controllerSource.indexOf(startMarker);
  const end = controllerSource.indexOf(endMarker, start);

  assert.ok(start >= 0, "Handler start unavailable");
  assert.ok(end > start, "Handler end unavailable");

  return controllerSource.slice(start, end);
}

const answer = handler(
  "const saveMockTestAnswer = async (req, res) => {",
  "const roundToTwo = (value) => {"
);

const submit = handler(
  "const submitMockTestAttempt = async (req, res) => {",
  "const getMockTestResult = async (req, res) => {"
);

function transactionalCallback(source) {
  const marker = ".withTransaction(async () => {";
  const start = source.indexOf(marker);

  assert.ok(
    start >= 0,
    "Missing explicit transaction callback"
  );

  // The implementation must use a dedicated transaction
  // callback and finalize its HTTP response afterward.
  return source.slice(start);
}

test(
  "B4 transaction contract: both operations create a database session",
  () => {
    assert.match(answer, /mongoose\.startSession\s*\(/);
    assert.match(submit, /mongoose\.startSession\s*\(/);
  }
);

test(
  "B4 transaction contract: both operations coordinate through transactions",
  () => {
    assert.match(answer, /\.withTransaction\s*\(/);
    assert.match(submit, /\.withTransaction\s*\(/);
  }
);

test(
  "B4 transaction contract: shared attempt is read and saved with a session",
  () => {
    for (const source of [answer, submit]) {
      const callback = transactionalCallback(source);

      assert.match(
        callback,
        /TestAttempt\.findOne\s*\(/
      );

      assert.match(
        callback,
        /\.session\s*\(/
      );

      assert.match(
        callback,
        /\.save\s*\(\s*\{\s*session\s*[:},]/
      );
    }
  }
);

test(
  "B4 transaction contract: answer-detail persistence participates",
  () => {
    const answerCallback = transactionalCallback(answer);
    const submitCallback = transactionalCallback(submit);

    // Answer saving intentionally delegates detail initialization
    // to the shared helper, passing the transaction session.
    assert.match(
      answerCallback,
      /getOrCreateAttemptDetail\s*\(\s*tenantId\s*,\s*attempt\s*,\s*mockTestVersion\s*,\s*session\s*\)/
    );

    const helper = handler(
      "const getOrCreateAttemptDetail = async (",
      "const buildAttemptAnswerStatePayload = (attemptDetail) => {"
    );

    assert.match(
      helper,
      /TestAttemptDetail\.findOne\s*\(/
    );

    assert.match(
      helper,
      /await query\.session\s*\(\s*session\s*\)/
    );

    assert.match(
      helper,
      /existingDetail\.save\s*\(\s*\{\s*session\s*\}\s*\)/
    );

    assert.match(
      helper,
      /TestAttemptDetail\.create\s*\(\s*\[\s*detailPayload\s*\]\s*,\s*\{\s*session\s*\}/
    );

    // Submission intentionally loads its existing detail directly.
    assert.match(
      submitCallback,
      /TestAttemptDetail\.findOne\s*\(/
    );

    assert.match(
      submitCallback,
      /studentId\s*,\s*\}\s*\)\.session\s*\(\s*session\s*\)/
    );

    // Both mutation paths must write the detail under their session.
    for (const callback of [answerCallback, submitCallback]) {
      assert.match(
        callback,
        /attemptDetail\.save\s*\(\s*\{\s*session\s*[:},]/
      );
    }
  }
);

test(
  "B4 transaction contract: retries revalidate the attempt and timing",
  () => {
    const callback = transactionalCallback(answer);

    assert.match(
      callback,
      /resolveAttemptTimingState\s*\(/
    );

    assert.match(
      callback,
      /new Date\s*\(/
    );

    assert.match(
      callback,
      /status\s*!==\s*["']in_progress["']/
    );
  }
);

test(
  "B4 transaction contract: submission computes summaries transactionally",
  () => {
    const callback = transactionalCallback(submit);

    assert.match(
      callback,
      /buildSubmittedAttemptSummaries\s*\(/
    );

    assert.match(
      callback,
      /sumAnswerTimeSpentSeconds\s*\(/
    );

    assert.match(
      callback,
      /status\s*=\s*["']submitted["']/
    );
  }
);

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parsePublicLearningQuiz, createPublicQuizAttempt, reducePublicQuizAttempt,
  getPublicQuizMissedIds, getPublicQuizScore,
} from "../lib/publicLearningQuiz.ts";
import { normalizePublicContent } from "../lib/publicContentMarkdown.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/publicLearningQuiz.json", import.meta.url), "utf8"));
const parsed = parsePublicLearningQuiz(JSON.stringify(fixture));
assert.ok(parsed.ok);
const quiz = parsed.quiz;
const round = (data, attempt, answers) => answers.reduce((state, index) => {
  const selected = reducePublicQuizAttempt(data, state, { type: "select", index });
  const checked = reducePublicQuizAttempt(data, selected, { type: "check" });
  return reducePublicQuizAttempt(data, checked, { type: "next" });
}, attempt);

test("partial first round, missed-only retries and original score are kept distinct", () => {
  let attempt = round(quiz, createPublicQuizAttempt(quiz), [2, 0, 3]);
  assert.equal(attempt.phase, "complete");
  assert.equal(getPublicQuizScore(quiz, attempt), 1);
  assert.equal(attempt.firstScore, 1);
  assert.deepEqual(getPublicQuizMissedIds(quiz, attempt), ["dyarchy", "federation"]);
  attempt = reducePublicQuizAttempt(quiz, attempt, { type: "retry" });
  assert.deepEqual(attempt.questionIds, ["dyarchy", "federation"]);
  assert.deepEqual(attempt.answers, {});
  assert.equal(attempt.selected, null);
  assert.equal(attempt.round, 1);
  attempt = round(quiz, attempt, [1, 3]);
  assert.equal(getPublicQuizScore(quiz, attempt), 1);
  assert.equal(attempt.firstScore, 1);
  assert.deepEqual(getPublicQuizMissedIds(quiz, attempt), ["federation"]);
  attempt = round(quiz, reducePublicQuizAttempt(quiz, attempt, { type: "retry" }), [0]);
  assert.equal(attempt.round, 2);
  assert.equal(getPublicQuizScore(quiz, attempt), 1);
  assert.deepEqual(getPublicQuizMissedIds(quiz, attempt), []);
  assert.equal(attempt.firstScore, 1);
  assert.equal(reducePublicQuizAttempt(quiz, attempt, { type: "retry" }), attempt);
});

test("checking twice or changing a checked response cannot inflate the score", () => {
  const initial = createPublicQuizAttempt(quiz);
  for (const action of [{ type: "check" }, { type: "next" }, { type: "retry" }, { type: "select", index: 99 }, { type: "select", index: -1 }, { type: "select", index: 1.5 }]) {
    assert.equal(reducePublicQuizAttempt(quiz, initial, action), initial);
  }
  const selected = reducePublicQuizAttempt(quiz, initial, { type: "select", index: 2 });
  const checked = reducePublicQuizAttempt(quiz, selected, { type: "check" });
  assert.equal(getPublicQuizScore(quiz, checked), 1);
  assert.equal(reducePublicQuizAttempt(quiz, checked, { type: "check" }), checked);
  assert.equal(reducePublicQuizAttempt(quiz, checked, { type: "select", index: 0 }), checked);
  assert.deepEqual(initial.answers, {});
});

test("zero, perfect and one-question rounds can complete and fully restart", () => {
  for (const [answers, expected] of [[[0, 0, 3], 0], [[2, 1, 0], 3]]) {
    const done = round(quiz, createPublicQuizAttempt(quiz), answers);
    assert.equal(done.phase, "complete");
    assert.equal(getPublicQuizScore(quiz, done), expected);
    assert.deepEqual(reducePublicQuizAttempt(quiz, done, { type: "restart" }), createPublicQuizAttempt(quiz));
  }
  const single = { ...quiz, questions: [quiz.questions[0]] };
  const done = round(single, createPublicQuizAttempt(single), [2]);
  assert.equal(done.firstScore, 1);
  assert.equal(done.phase, "complete");
});

test("each quiz has its own state and validated data never mutates the source", () => {
  const before = JSON.stringify(quiz);
  round(quiz, createPublicQuizAttempt(quiz), [2, 1, 0]);
  const independent = createPublicQuizAttempt(quiz);
  assert.equal(independent.firstScore, null);
  assert.deepEqual(independent.answers, {});
  assert.equal(JSON.stringify(quiz), before);
  const result = parsePublicLearningQuiz(JSON.stringify({ ...fixture, style: "bad", onClick: "bad" }));
  assert.ok(result.ok);
  assert.equal("style" in result.quiz, false);
  assert.equal("onClick" in result.quiz, false);
});

test("invalid, oversized or ambiguous authoring data fails without a partial quiz", () => {
  const reject = (value) => assert.deepEqual(parsePublicLearningQuiz(JSON.stringify(value)), { ok: false });
  assert.deepEqual(parsePublicLearningQuiz("not json"), { ok: false });
  assert.deepEqual(parsePublicLearningQuiz("x".repeat(100001)), { ok: false });
  for (const value of [null, [], { ...fixture, version: 2 }, { ...fixture, language: "auto" }, { ...fixture, questions: [] }, { ...fixture, questions: Array(21).fill(fixture.questions[0]) }]) reject(value);
  const question = fixture.questions[0];
  for (const badQuestion of [
    { ...question, answerIndex: 4 }, { ...question, answerIndex: "2" },
    { ...question, prompt: " " }, { ...question, options: ["Same", " Same "] },
    { ...question, explanation: "" }, { ...question, kind: "pyq" },
    { ...question, revisionHref: "javascript:alert(1)" },
  ]) reject({ ...fixture, questions: [badQuestion] });
  reject({ ...fixture, questions: [question, question] });
});

test("PYQs require source attribution; unsafe links cannot reach the renderer", () => {
  const question = { ...fixture.questions[0], kind: "pyq", source: { label: "UPSC CSE Prelims · exam year, paper and question locator · adapted", url: "https://upsc.gov.in/example-paper.pdf" } };
  assert.ok(parsePublicLearningQuiz(JSON.stringify({ ...fixture, questions: [question] })).ok);
  for (const url of ["javascript:alert(1)", "data:text/html,bad", "//other.test/file", "http://other.test/file", "https://user:password@other.test/file"]) {
    const result = parsePublicLearningQuiz(JSON.stringify({ ...fixture, questions: [{ ...question, source: { ...question.source, url } }] }));
    assert.equal(result.ok, false);
  }
});

test("Hindi payloads and escaped multiline prompts survive normal Markdown and legacy imports", () => {
  const data = { ...fixture, language: "hi-IN", title: "अधिनियम: पुनरावृत्ति", questions: [{ ...fixture.questions[0], prompt: "कथन 1\nकथन 2" }] };
  const raw = JSON.stringify(data, null, 2);
  const markdown = `## क्विज़\r\n\r\n\`\`\`pravixo-quiz\r\n${raw}\r\n\`\`\``;
  const normalised = normalizePublicContent(markdown);
  assert.ok(normalised.includes("कथन 1\\nकथन 2"));
  assert.ok(parsePublicLearningQuiz(normalised.split("```pravixo-quiz\n")[1].split("\n```")[0]).ok);
  assert.equal(normalizePublicContent("## Legacy\\r\\n\\r\\nBody"), "## Legacy\n\nBody");
});

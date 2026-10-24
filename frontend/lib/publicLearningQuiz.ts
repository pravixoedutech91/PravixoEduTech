export const PUBLIC_QUIZ_FENCE = "pravixo-quiz";

export type PublicQuizQuestion = {
  id: string;
  kind: "practice" | "pyq";
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  source?: { label: string; url: string };
  revisionHref?: string;
};

export type PublicLearningQuizData = {
  version: 1;
  language: "en-IN" | "hi-IN";
  title: string;
  questions: PublicQuizQuestion[];
};

type ParseResult =
  | { ok: true; quiz: PublicLearningQuizData }
  | { ok: false };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

const sourceUrl = (value: unknown): value is string => {
  if (!text(value, 2048) || value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

const revisionHref = (value: unknown): value is string =>
  text(value, 500) && /^#[\p{L}\p{M}\p{N}_%-]+$/u.test(value);

// This is public revision material. Answers are deliberately sent to the reader;
// it must never be used to deliver protected mock-test questions or scores.
export const parsePublicLearningQuiz = (raw: string): ParseResult => {
  if (raw.length > 100_000) return { ok: false };
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1 ||
      (data.language !== "en-IN" && data.language !== "hi-IN") ||
      !text(data.title, 180) || !Array.isArray(data.questions) ||
      data.questions.length < 1 || data.questions.length > 20) return { ok: false };

    const ids = new Set<string>();
    const questions: PublicQuizQuestion[] = [];
    for (const question of data.questions) {
      if (!isRecord(question) || !text(question.id, 80) ||
        !/^[a-zA-Z0-9_-]+$/.test(question.id) || ids.has(question.id) ||
        (question.kind !== "practice" && question.kind !== "pyq") ||
        !text(question.prompt, 2000) || !text(question.explanation, 4000) ||
        !Array.isArray(question.options) || question.options.length < 2 ||
        question.options.length > 5 || !question.options.every((option) => text(option, 1000)) ||
        new Set(question.options.map((option: string) => option.trim())).size !== question.options.length ||
        !Number.isInteger(question.answerIndex) || (question.answerIndex as number) < 0 ||
        (question.answerIndex as number) >= question.options.length) return { ok: false };

      let source: PublicQuizQuestion["source"];
      if (question.source !== undefined) {
        if (!isRecord(question.source) || !text(question.source.label, 240) ||
          !sourceUrl(question.source.url)) return { ok: false };
        source = { label: question.source.label, url: question.source.url };
      }
      if (question.kind === "pyq" && !source) return { ok: false };
      if (question.revisionHref !== undefined && !revisionHref(question.revisionHref)) return { ok: false };

      ids.add(question.id);
      questions.push({
        id: question.id,
        kind: question.kind,
        prompt: question.prompt,
        options: [...question.options] as string[],
        answerIndex: question.answerIndex as number,
        explanation: question.explanation,
        ...(source ? { source } : {}),
        ...(question.revisionHref ? { revisionHref: question.revisionHref as string } : {}),
      });
    }
    // Copy only the supported data fields. Text renders as escaped React text,
    // never Markdown, executable HTML, styling, or component props.
    return { ok: true, quiz: { version: 1, language: data.language, title: data.title, questions } };
  } catch {
    return { ok: false };
  }
};

export type PublicQuizAttempt = {
  questionIds: string[];
  position: number;
  selected: number | null;
  answers: Record<string, number>;
  phase: "answering" | "feedback" | "complete";
  round: number;
  firstScore: number | null;
};

export type PublicQuizAction =
  | { type: "select"; index: number }
  | { type: "check" }
  | { type: "next" }
  | { type: "retry" }
  | { type: "restart" };

export const createPublicQuizAttempt = (quiz: PublicLearningQuizData): PublicQuizAttempt => ({
  questionIds: quiz.questions.map((question) => question.id),
  position: 0,
  selected: null,
  answers: {},
  phase: "answering",
  round: 0,
  firstScore: null,
});

export const getPublicQuizMissedIds = (quiz: PublicLearningQuizData, attempt: PublicQuizAttempt) =>
  attempt.questionIds.filter((id) => attempt.answers[id] !== quiz.questions.find((question) => question.id === id)?.answerIndex);

export const getPublicQuizScore = (quiz: PublicLearningQuizData, attempt: PublicQuizAttempt) =>
  attempt.questionIds.length - getPublicQuizMissedIds(quiz, attempt).length;

export const reducePublicQuizAttempt = (
  quiz: PublicLearningQuizData,
  attempt: PublicQuizAttempt,
  action: PublicQuizAction,
): PublicQuizAttempt => {
  if (action.type === "restart") return createPublicQuizAttempt(quiz);
  if (action.type === "retry") {
    if (attempt.phase !== "complete") return attempt;
    const missed = getPublicQuizMissedIds(quiz, attempt);
    if (!missed.length) return attempt;
    return { ...attempt, questionIds: missed, answers: {}, position: 0, selected: null, phase: "answering", round: attempt.round + 1 };
  }
  const question = quiz.questions.find((item) => item.id === attempt.questionIds[attempt.position]);
  if (!question) return attempt;
  if (action.type === "select" && attempt.phase === "answering" &&
    Number.isInteger(action.index) && action.index >= 0 && action.index < question.options.length) {
    return { ...attempt, selected: action.index };
  }
  if (action.type === "check" && attempt.phase === "answering" && attempt.selected !== null) {
    return { ...attempt, answers: { ...attempt.answers, [question.id]: attempt.selected }, phase: "feedback" };
  }
  if (action.type === "next" && attempt.phase === "feedback") {
    if (attempt.position + 1 === attempt.questionIds.length) {
      return { ...attempt, phase: "complete", firstScore: attempt.firstScore ?? getPublicQuizScore(quiz, attempt) };
    }
    return { ...attempt, position: attempt.position + 1, selected: null, phase: "answering" };
  }
  return attempt;
};

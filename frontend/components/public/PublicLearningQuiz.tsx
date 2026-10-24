"use client";

import { useEffect, useId, useReducer, useRef } from "react";
import {
  createPublicQuizAttempt, getPublicQuizMissedIds, getPublicQuizScore,
  reducePublicQuizAttempt, type PublicLearningQuizData,
} from "@/lib/publicLearningQuiz";

const copy = {
  "en-IN": {
    eyebrow: "PravixoEduTech · Revision quiz", practice: "Original practice", pyq: "PYQ · adapted",
    rules: "Choose one answer, then check it. 1 point per correct answer; no penalty.",
    session: "Progress resets when you refresh or leave this page.",
    question: "Question", of: "of", check: "Check answer", next: "Next question", results: "See results",
    correct: "Correct", incorrect: "Not quite", answer: "Correct answer", explanation: "Why this answer?",
    revision: "Revise this concept", source: "Question source", progress: "Questions checked",
    firstRound: "First round", retryRound: "Retry round", score: "Score", complete: "Round complete",
    firstScore: "First-round score", retry: "Retry incorrect questions", restart: "Start again: all questions",
    missed: "Review these concepts", allCorrect: "Every answer in this round is correct.",
    noJs: "JavaScript is off. You can still use the questions and reveal their explanations below.",
    reveal: "Show answer and explanation", yourAnswer: "Your answer",
  },
  "hi-IN": {
    eyebrow: "PravixoEduTech · पुनरावृत्ति क्विज़", practice: "मौलिक अभ्यास", pyq: "पिछला प्रश्न · रूपांतरित",
    rules: "एक उत्तर चुनें, फिर जाँचें। हर सही उत्तर पर 1 अंक; गलत उत्तर पर अंक नहीं कटेंगे।",
    session: "पृष्ठ रीफ़्रेश करने या छोड़ने पर आपकी प्रगति रीसेट हो जाएगी।",
    question: "प्रश्न", of: "/", check: "उत्तर जाँचें", next: "अगला प्रश्न", results: "परिणाम देखें",
    correct: "सही उत्तर", incorrect: "उत्तर सही नहीं है", answer: "सही उत्तर", explanation: "यह उत्तर क्यों सही है?",
    revision: "संबंधित भाग दोहराएँ", source: "प्रश्न का स्रोत", progress: "जाँचे गए प्रश्न",
    firstRound: "पहला प्रयास", retryRound: "पुनः प्रयास", score: "अंक", complete: "प्रयास पूरा हुआ",
    firstScore: "पहले प्रयास के अंक", retry: "केवल गलत प्रश्न दोबारा करें", restart: "सभी प्रश्न फिर से शुरू करें",
    missed: "इन अवधारणाओं को दोहराएँ", allCorrect: "इस प्रयास के सभी उत्तर सही हैं।",
    noJs: "JavaScript बंद है। नीचे प्रश्न पढ़ें और उत्तर व व्याख्या खोलकर अपना अभ्यास जाँचें।",
    reveal: "उत्तर और व्याख्या देखें", yourAnswer: "आपका उत्तर",
  },
};

const primaryButton = "min-h-12 rounded-xl bg-violet-700 px-5 py-3 text-base font-bold leading-7 text-white transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500";
const secondaryButton = "min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-bold leading-7 text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-700";

export default function PublicLearningQuiz({ quiz }: { quiz: PublicLearningQuizData }) {
  const labels = copy[quiz.language];
  const quizId = useId();
  const focusTarget = useRef<HTMLDivElement>(null);
  const hasInteracted = useRef(false);
  const [attempt, dispatch] = useReducer(
    (state: ReturnType<typeof createPublicQuizAttempt>, action: Parameters<typeof reducePublicQuizAttempt>[2]) =>
      reducePublicQuizAttempt(quiz, state, action),
    quiz, createPublicQuizAttempt,
  );
  const question = quiz.questions.find((item) => item.id === attempt.questionIds[attempt.position])!;
  const checked = attempt.phase === "feedback";
  const complete = attempt.phase === "complete";
  const score = getPublicQuizScore(quiz, attempt);
  const missed = getPublicQuizMissedIds(quiz, attempt);
  const roundLabel = attempt.round === 0 ? labels.firstRound : `${labels.retryRound} ${attempt.round}`;
  const transition = (action: Parameters<typeof reducePublicQuizAttempt>[2]) => {
    hasInteracted.current = true;
    dispatch(action);
  };

  // Keep keyboard and screen-reader users at the newly displayed content.
  // Never move focus when a reader first loads or scrolls through the article.
  useEffect(() => {
    if (hasInteracted.current && focusTarget.current) {
      focusTarget.current.focus({ preventScroll: true });
      focusTarget.current.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }, [attempt.phase, attempt.position, attempt.round]);

  return (
    <section lang={quiz.language} aria-labelledby={`${quizId}-title`} className="my-8 min-w-0 overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
      <div className="border-b border-violet-100 bg-violet-50 px-4 py-5 sm:px-6">
        <div className="text-xs font-black uppercase tracking-wide text-violet-800">{labels.eyebrow}</div>
        <h3 id={`${quizId}-title`} className="mt-2 text-xl font-black leading-9 text-slate-950">{quiz.title}</h3>
        <p className="mt-2 text-base leading-8 text-slate-700">{labels.rules}</p>
        <p className="mt-1 text-sm leading-7 text-slate-600">{labels.session}</p>
      </div>

      <div className="public-learning-quiz-interactive p-4 sm:p-6">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm font-bold leading-7 text-slate-600">
          <span>{roundLabel}</span>
          <span>{labels.score}: {score} / {attempt.questionIds.length}</span>
        </div>
        <progress value={Object.keys(attempt.answers).length} max={attempt.questionIds.length} aria-label={labels.progress} className="mb-5 h-2 w-full overflow-hidden rounded-full accent-violet-700" />

        {complete ? (
          <div ref={focusTarget} tabIndex={-1} className="scroll-mt-52 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600">
            <h4 className="text-xl font-black leading-9 text-slate-950">{labels.complete}: {score} / {attempt.questionIds.length}</h4>
            {attempt.round > 0 && <p className="mt-2 text-base leading-8 text-slate-700">{labels.firstScore}: {attempt.firstScore} / {quiz.questions.length}</p>}
            {missed.length ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h5 className="font-bold leading-8 text-slate-950">{labels.missed}</h5>
                <ul className="mt-2 list-disc space-y-3 pl-5 text-base leading-8 text-slate-800">
                  {missed.map((id) => {
                    const item = quiz.questions.find((entry) => entry.id === id)!;
                    return <li key={id}>{item.prompt}{item.revisionHref && <a href={item.revisionHref} className="ml-2 font-bold text-violet-800 underline underline-offset-4">{labels.revision}</a>}</li>;
                  })}
                </ul>
              </div>
            ) : <p className="mt-3 rounded-xl bg-emerald-50 p-4 text-base font-bold leading-8 text-emerald-900">{labels.allCorrect}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              {missed.length > 0 && <button type="button" onClick={() => transition({ type: "retry" })} className={primaryButton}>{labels.retry} ({missed.length})</button>}
              <button type="button" onClick={() => transition({ type: "restart" })} className={secondaryButton}>{labels.restart}</button>
            </div>
          </div>
        ) : (
          <>
            <div ref={attempt.phase === "answering" ? focusTarget : undefined} tabIndex={-1} className="scroll-mt-52 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600">
              <p className="text-sm font-bold leading-7 text-violet-800">{labels.question} {attempt.position + 1} {labels.of} {attempt.questionIds.length} · {question.kind === "pyq" ? labels.pyq : labels.practice}</p>
              <fieldset className="mt-3 min-w-0" disabled={checked}>
                <legend className={`mb-4 whitespace-pre-line font-bold text-slate-950 ${quiz.language === "hi-IN" ? "text-lg leading-9" : "text-base leading-8"}`}>{question.prompt}</legend>
                <div className="space-y-3">
                  {question.options.map((option, index) => {
                    const selected = attempt.selected === index;
                    const correct = checked && index === question.answerIndex;
                    const wrong = checked && selected && !correct;
                    const status = correct ? ` · ${labels.answer}` : wrong ? ` · ${labels.yourAnswer}` : "";
                    return (
                      <label key={index} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 text-base leading-8 transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-violet-700 ${correct ? "border-emerald-600 bg-emerald-50 text-emerald-950" : wrong ? "border-rose-600 bg-rose-50 text-rose-950" : selected ? "border-violet-600 bg-violet-50 text-slate-950" : "border-slate-200 bg-white text-slate-800"} ${checked ? "cursor-default" : "hover:border-violet-400"}`}>
                        <input type="radio" name={`${quizId}-${question.id}-${attempt.round}`} checked={selected} onChange={() => dispatch({ type: "select", index })} className="mt-2 h-4 w-4 shrink-0 accent-violet-700" />
                        <span className="min-w-0 break-words whitespace-pre-line"><span className="font-bold">{String.fromCharCode(65 + index)}.</span> {option}{status && <span className="font-bold">{status}</span>}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            {checked && (
              <div ref={focusTarget} tabIndex={-1} className={`mt-5 scroll-mt-52 rounded-2xl border p-4 text-base leading-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 ${attempt.selected === question.answerIndex ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <h4 className="font-black text-slate-950">{attempt.selected === question.answerIndex ? labels.correct : labels.incorrect}</h4>
                <p className="mt-1 font-bold text-slate-900">{labels.answer}: {String.fromCharCode(65 + question.answerIndex)}. {question.options[question.answerIndex]}</p>
                <p className="mt-3 font-bold text-slate-950">{labels.explanation}</p>
                <p className="mt-1 whitespace-pre-line text-slate-800">{question.explanation}</p>
                {question.revisionHref && <a href={question.revisionHref} className="mt-3 inline-block font-bold text-violet-800 underline underline-offset-4">{labels.revision}</a>}
              </div>
            )}
            {question.source && <p className="mt-4 text-sm leading-7 text-slate-600">{labels.source}: <a href={question.source.url} target="_blank" rel="noopener noreferrer" className="break-words font-bold text-violet-800 underline underline-offset-4">{question.source.label} ↗</a></p>}
            <div className="mt-5">
              {checked
                ? <button type="button" onClick={() => transition({ type: "next" })} className={primaryButton}>{attempt.position + 1 === attempt.questionIds.length ? labels.results : labels.next}</button>
                : <button type="button" disabled={attempt.selected === null} onClick={() => transition({ type: "check" })} className={primaryButton}>{labels.check}</button>}
            </div>
          </>
        )}
      </div>

      <noscript>
        <style>{".public-learning-quiz-interactive { display: none; }"}</style>
        <div className="p-4 sm:p-6">
          <p className="mb-5 rounded-xl bg-amber-50 p-4 text-base leading-8">{labels.noJs}</p>
          <ol className="list-decimal space-y-7 pl-5">
            {quiz.questions.map((item) => <li key={item.id} className="text-base leading-8 text-slate-800">
              <p className="font-bold whitespace-pre-line">{item.prompt}</p>
              <p className="text-sm text-violet-800">{item.kind === "pyq" ? labels.pyq : labels.practice}</p>
              <ul className="my-3 space-y-1">{item.options.map((option, index) => <li key={index}>{String.fromCharCode(65 + index)}. {option}</li>)}</ul>
              <details className="rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer font-bold">{labels.reveal}</summary>
                <p>{labels.answer}: {String.fromCharCode(65 + item.answerIndex)}. {item.options[item.answerIndex]}</p>
                <p className="mt-2 whitespace-pre-line">{item.explanation}</p>
                {item.revisionHref && <a href={item.revisionHref} className="font-bold text-violet-800 underline">{labels.revision}</a>}
              </details>
              {item.source && <a href={item.source.url} rel="noopener noreferrer" className="mt-2 inline-block break-words font-bold text-violet-800 underline">{labels.source}: {item.source.label}</a>}
            </li>)}
          </ol>
        </div>
      </noscript>
    </section>
  );
}

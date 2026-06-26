"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

const STUDENT_TOKEN_STORAGE_KEY = "pravixoStudentToken";
const STUDENT_PROFILE_STORAGE_KEY = "pravixoStudentProfile";
const ACTIVE_ATTEMPT_STORAGE_KEY = "pravixoActiveAttempt";
const ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY = "pravixoActiveAttemptPayload";

const INVALID_STUDENT_SESSION_MESSAGE =
    "Your student session has expired or was invalidated. Please login again.";

const clearStudentSessionStorage = () => {
    window.localStorage.removeItem(STUDENT_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STUDENT_PROFILE_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY);
};

const isInvalidStudentSessionResponse = (
    response: Response,
    message?: string
) => {
    const normalizedMessage = (message || "").toLowerCase();

    return (
        response.status === 401 ||
        response.status === 403 ||
        normalizedMessage.includes("jwt expired") ||
        normalizedMessage.includes("invalid token") ||
        normalizedMessage.includes("not authorized") ||
        normalizedMessage.includes("session invalid")
    );
};

type ScoreSummary = {
    totalQuestions: number;
    attempted: number;
    correct: number;
    wrong: number;
    skipped: number;
    score: number;
    maxScore: number;
    percentage: number;
    accuracy: number;
    negativeMarks: number;
};

type ReviewMetadata = {
    isDetailedReviewAvailable: boolean;
    detailedReviewExpiresAt: string | null;
    solutionVisibility: string | null;
    reviewRetentionDays: number;
};

type ReviewAttempt = {
    _id: string;
    attemptNumber: number;
    status: string;
    startedAt: string;
    submittedAt: string | null;
    expiresAt: string | null;
    totalDurationSeconds: number;
    timeSpentSeconds: number;
    scoreSummary: ScoreSummary;
    review: ReviewMetadata;
};

type ReviewTest = {
    _id: string;
    mockTestId: string;
    versionNumber: number;
    title: string;
    slug: string;
    testType: string;
    accessType: string;
};

type ContentBlock = {
    blockType: string;
    textEn?: string;
    textHi?: string;
    imageUrl?: string;
    altText?: string;
    captionEn?: string;
    captionHi?: string;
    latex?: string;
    tableData?: unknown;
    order?: number;
    isVisible?: boolean;
};

type QuestionGroup = {
    questionGroupId: string;
    title: string;
    slug: string;
    description?: string;
    groupType: string;
    subject: string;
    topic: string;
    subTopic?: string;
    instructionEn?: string;
    instructionHi?: string;
    passageEn?: string;
    passageHi?: string;
    contentBlocks?: ContentBlock[];
    displayMode?: string;
    expectedQuestionCount?: number;
    difficulty?: string;
    tags?: string[];
};

type ReviewOption = {
    optionId: string;
    textEn?: string;
    textHi?: string;
    imageUrl?: string;
};

type StudentAnswer = {
    selectedOptionId: string | null;
    isCorrect: boolean;
    marksAwarded: number;
    negativeMarksApplied: number;
    timeSpentSeconds: number;
    confidenceLevel: string;
    status: string;
    visited: boolean;
    markedForReview: boolean;
    answeredAt: string | null;
};

type ReviewQuestion = {
    _id: string;
    questionId: string;
    questionGroupId?: string | null;
    groupQuestionOrder?: number | null;
    questionType: string;
    sourceType: string;
    subject: string;
    topic: string;
    subTopic?: string;
    questionTextEn?: string;
    questionTextHi?: string;
    questionImageUrl?: string;
    options?: ReviewOption[];
    correctOptionId?: string | null;
    explanationEn?: string;
    explanationHi?: string;
    explanationImageUrl?: string;
    marks: number;
    negativeMarks: number;
    difficulty: string;
    tags?: string[];
    order: number;
    studentAnswer?: StudentAnswer | null;
};

type ReviewSection = {
    sectionSlug: string;
    name: string;
    sectionType: string;
    durationMinutes: number;
    questionCount: number;
    marksPerQuestion: number;
    negativeMarks: number;
    order: number;
    questionGroups?: QuestionGroup[];
    questions?: ReviewQuestion[];
};

type ReviewPayload = {
    serverTime: string;
    test: ReviewTest;
    attempt: ReviewAttempt;
    sections: ReviewSection[];
};

type ReviewResponse = {
    success: boolean;
    message?: string;
    data?: ReviewPayload;
};

const getStoredStudentTokenSnapshot = () => {
    if (typeof window === "undefined") {
        return "";
    }

    return window.localStorage.getItem(STUDENT_TOKEN_STORAGE_KEY) || "";
};

const getEmptyServerSnapshot = () => "";

const subscribeLocalStorage = (callback: () => void) => {
    if (typeof window === "undefined") {
        return () => undefined;
    }

    const listener = () => callback();
    window.addEventListener("storage", listener);

    return () => window.removeEventListener("storage", listener);
};

const formatDateTime = (value?: string | null) => {
    if (!value) {
        return "-";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
};

const formatSeconds = (seconds?: number | null) => {
    const safeSeconds = Math.max(Number(seconds || 0), 0);

    if (safeSeconds < 60) {
        return `${safeSeconds}s`;
    }

    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
};

const formatPercent = (value?: number | null) => `${Number(value || 0)}%`;

const getQuestionStatusLabel = (question: ReviewQuestion) => {
    if (!question.studentAnswer) {
        return "Not visited";
    }

    if (question.studentAnswer.status === "skipped") {
        return "Skipped";
    }

    if (question.studentAnswer.isCorrect) {
        return "Correct";
    }

    return "Wrong";
};

const getQuestionStatusClassName = (question: ReviewQuestion) => {
    const answer = question.studentAnswer;

    if (!answer || answer.status === "skipped") {
        return "bg-slate-100 text-slate-700 ring-slate-200";
    }

    if (answer.isCorrect) {
        return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    }

    return "bg-rose-50 text-rose-700 ring-rose-200";
};

const renderOptionalText = (primary?: string, secondary?: string) => {
    if (!primary && !secondary) {
        return null;
    }

    return (
        <div className="space-y-1">
            {primary ? <p>{primary}</p> : null}
            {secondary ? <p className="text-sm text-slate-500">{secondary}</p> : null}
        </div>
    );
};

const renderContentBlock = (block: ContentBlock, index: number) => {
    if (block.isVisible === false) {
        return null;
    }

    return (
        <div
            key={`${block.blockType}-${block.order || index}`}
            className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-100"
        >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {block.blockType}
            </p>

            {renderOptionalText(block.textEn, block.textHi)}

            {block.latex ? (
                <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-3 text-xs text-slate-700 ring-1 ring-slate-200">
                    {block.latex}
                </pre>
            ) : null}

            {block.imageUrl ? (
                <figure className="mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={block.imageUrl}
                        alt={block.altText || block.captionEn || "Review image"}
                        className="max-h-80 rounded-xl object-contain ring-1 ring-slate-200"
                    />
                    {block.captionEn || block.captionHi ? (
                        <figcaption className="mt-2 text-xs text-slate-500">
                            {block.captionEn || block.captionHi}
                        </figcaption>
                    ) : null}
                </figure>
            ) : null}

            {block.tableData ? (
                <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-3 text-xs text-slate-700 ring-1 ring-slate-200">
                    {JSON.stringify(block.tableData, null, 2)}
                </pre>
            ) : null}
        </div>
    );
};

const getOptionClassName = ({
    isCorrectOption,
    isSelectedOption,
}: {
    isCorrectOption: boolean;
    isSelectedOption: boolean;
}) => {
    if (isCorrectOption) {
        return "border-emerald-300 bg-emerald-50 text-emerald-900";
    }

    if (isSelectedOption) {
        return "border-rose-300 bg-rose-50 text-rose-900";
    }

    return "border-slate-200 bg-white text-slate-700";
};

export default function StudentAttemptReviewPage() {
    const router = useRouter();
    const params = useParams<{ attemptId: string }>();
    const attemptId = useMemo(() => String(params.attemptId || ""), [params]);

    const storedStudentToken = useSyncExternalStore(
        subscribeLocalStorage,
        getStoredStudentTokenSnapshot,
        getEmptyServerSnapshot
    );

    const [review, setReview] = useState<ReviewPayload | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");

    const effectiveStudentToken = storedStudentToken.trim();
    const autoLoadKeyRef = useRef("");

    const fetchReview = useCallback(async () => {
        if (!attemptId) {
            setMessage("Attempt ID is missing from the URL.");
            return;
        }

        if (!effectiveStudentToken) {
            setMessage("Please login as a student first to load review.");
            return;
        }

        setIsLoading(true);
        setMessage("");

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/student/attempts/${attemptId}/review`,
                {
                    headers: {
                        Authorization: `Bearer ${effectiveStudentToken}`,
                    },
                }
            );

            const result = (await response.json()) as ReviewResponse;

            if (isInvalidStudentSessionResponse(response, result.message)) {
                clearStudentSessionStorage();
                setReview(null);
                setMessage(INVALID_STUDENT_SESSION_MESSAGE);
                router.push("/student/login");
                return;
            }

            if (!response.ok || !result.success || !result.data) {
                throw new Error(result.message || "Unable to fetch review.");
            }

            setReview(result.data);
        } catch (caught) {
            const errorMessage =
                caught instanceof Error ? caught.message : "Unable to fetch review.";
            setMessage(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [attemptId, effectiveStudentToken, router]);

    useEffect(() => {
        const key = `${attemptId}:${effectiveStudentToken}`;

        if (!attemptId || !effectiveStudentToken || autoLoadKeyRef.current === key) {
            return;
        }

        autoLoadKeyRef.current = key;

        void fetchReview();
    }, [attemptId, effectiveStudentToken, fetchReview]);

    const summary = review?.attempt.scoreSummary;

    const totalReviewQuestions = useMemo(() => {
        return (review?.sections || []).reduce((total, section) => {
            return total + (section.questions || []).length;
        }, 0);
    }, [review]);

    const questionNumberMap = useMemo(() => {
        const map = new Map<string, number>();
        let questionNumber = 1;

        (review?.sections || []).forEach((section) => {
            (section.questions || []).forEach((question) => {
                map.set(question._id, questionNumber);
                questionNumber += 1;
            });
        });

        return map;
    }, [review]);

    const handleLogout = () => {
        const shouldLogout = window.confirm(
            "Are you sure you want to logout? Your saved student session will be cleared."
        );

        if (!shouldLogout) {
            return;
        }

        clearStudentSessionStorage();

        setReview(null);
        setMessage("You have been logged out. Please login again.");

        router.push("/student/login");
    };

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
            <div className="mx-auto max-w-6xl space-y-6">
                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-700">
                                Detailed Review
                            </p>
                            <h1 className="mt-3 text-3xl font-bold">
                                {review?.test.title || "Student Attempt Review"}
                            </h1>
                            <p className="mt-2 text-sm text-slate-600">
                                Attempt #{review?.attempt.attemptNumber || "-"} | Version {review?.test.versionNumber || "-"} | {review?.attempt.status || "-"}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/student/mock-tests"
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Back to Mock Tests
                            </Link>

                            <Link
                                href={`/student/attempts/${attemptId}/result`}
                                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Back to Result
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                                Student Session
                            </p>

                            <h2 className="mt-2 text-xl font-bold text-slate-950">
                                Review Access
                            </h2>

                            <p className="mt-2 text-sm text-slate-600">
                                {effectiveStudentToken
                                    ? "You are logged in. Review loads using your saved student session."
                                    : "Please login first to view this detailed review."}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {effectiveStudentToken ? (
                                <button
                                    type="button"
                                    onClick={() => void fetchReview()}
                                    disabled={isLoading}
                                    className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                    {isLoading ? "Loading..." : "Refresh Review"}
                                </button>
                            ) : (
                                <Link
                                    href="/student/login"
                                    className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                                >
                                    Login
                                </Link>
                            )}

                            {effectiveStudentToken ? (
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="rounded-2xl border border-red-200 bg-red-50 px-6 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
                                >
                                    Logout
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {message ? (
                        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
                            {message}
                        </p>
                    ) : null}
                </section>

                {review && summary ? (
                    <>
                        <section className="grid gap-4 md:grid-cols-4">
                            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Score
                                </p>
                                <p className="mt-3 text-2xl font-bold">
                                    {summary.score} / {summary.maxScore}
                                </p>
                            </div>

                            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Correct
                                </p>
                                <p className="mt-3 text-2xl font-bold text-emerald-700">
                                    {summary.correct}
                                </p>
                            </div>

                            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Wrong
                                </p>
                                <p className="mt-3 text-2xl font-bold text-rose-700">
                                    {summary.wrong}
                                </p>
                            </div>

                            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Time Spent
                                </p>
                                <p className="mt-3 text-2xl font-bold">
                                    {formatSeconds(review.attempt.timeSpentSeconds)}
                                </p>
                            </div>
                        </section>

                        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">Question Review</h2>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {totalReviewQuestions} question(s) | Submitted at {formatDateTime(review.attempt.submittedAt)}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-100">
                                    Accuracy: <span className="font-semibold">{formatPercent(summary.accuracy)}</span>
                                </div>
                            </div>
                        </section>

                        {review.sections.map((section) => (
                            <section
                                key={section.sectionSlug}
                                className="space-y-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                            >
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                                        Section
                                    </p>
                                    <h2 className="mt-2 text-2xl font-bold">{section.name}</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {section.sectionType.toUpperCase()} | {section.durationMinutes} minutes
                                    </p>
                                </div>

                                {(section.questionGroups || []).length > 0 ? (
                                    <div className="space-y-4">
                                        {(section.questionGroups || []).map((group) => (
                                            <article
                                                key={group.questionGroupId}
                                                className="rounded-3xl border border-blue-100 bg-blue-50/40 p-5"
                                            >
                                                <div className="mb-4 flex flex-wrap gap-2">
                                                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                                        {group.groupType}
                                                    </span>
                                                    {group.topic ? (
                                                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
                                                            {group.topic}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <h3 className="text-lg font-bold">{group.title}</h3>
                                                <div className="mt-3 text-sm text-slate-700">
                                                    {renderOptionalText(group.instructionEn, group.instructionHi)}
                                                </div>
                                                <div className="mt-4 space-y-3">
                                                    {(group.contentBlocks || []).map(renderContentBlock)}
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                ) : null}

                                <div className="space-y-5">
                                    {(section.questions || []).map((question) => {
                                        const questionNumber = questionNumberMap.get(question._id) || question.order;
                                        const selectedOptionId = question.studentAnswer?.selectedOptionId || null;
                                        const linkedGroup = (section.questionGroups || []).find(
                                            (group) => group.questionGroupId === question.questionGroupId
                                        );

                                        return (
                                            <article
                                                key={question._id}
                                                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                                            >
                                                <div className="mb-4 flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                                                        Question {questionNumber}
                                                    </span>
                                                    <span
                                                        className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getQuestionStatusClassName(
                                                            question
                                                        )}`}
                                                    >
                                                        {getQuestionStatusLabel(question)}
                                                    </span>
                                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                                        +{question.marks}
                                                    </span>
                                                    <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                                                        -{question.negativeMarks}
                                                    </span>
                                                    {linkedGroup ? (
                                                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                                            {linkedGroup.topic || linkedGroup.title}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <div className="space-y-2 text-lg font-semibold">
                                                    {renderOptionalText(question.questionTextEn, question.questionTextHi)}
                                                </div>

                                                {question.questionImageUrl ? (
                                                    <figure className="mt-4">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={question.questionImageUrl}
                                                            alt="Question image"
                                                            className="max-h-80 rounded-xl object-contain ring-1 ring-slate-200"
                                                        />
                                                    </figure>
                                                ) : null}

                                                <div className="mt-5 grid gap-3 md:grid-cols-2">
                                                    {(question.options || []).map((option) => {
                                                        const isCorrectOption =
                                                            option.optionId === question.correctOptionId;
                                                        const isSelectedOption =
                                                            option.optionId === selectedOptionId;

                                                        return (
                                                            <div
                                                                key={option.optionId}
                                                                className={`rounded-2xl border p-4 ${getOptionClassName({
                                                                    isCorrectOption,
                                                                    isSelectedOption,
                                                                })}`}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold ring-1 ring-current">
                                                                        {option.optionId}
                                                                    </span>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="font-semibold">
                                                                            {option.textEn || option.textHi || "-"}
                                                                        </p>
                                                                        {option.textHi && option.textHi !== option.textEn ? (
                                                                            <p className="mt-1 text-sm opacity-80">
                                                                                {option.textHi}
                                                                            </p>
                                                                        ) : null}

                                                                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                                                                            {isCorrectOption ? (
                                                                                <span className="rounded-full bg-emerald-600 px-2 py-1 text-white">
                                                                                    Correct Answer
                                                                                </span>
                                                                            ) : null}
                                                                            {isSelectedOption ? (
                                                                                <span className="rounded-full bg-slate-900 px-2 py-1 text-white">
                                                                                    Your Answer
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-4">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                            Your Answer
                                                        </p>
                                                        <p className="mt-1 font-bold">
                                                            {selectedOptionId || "Skipped"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                            Correct Answer
                                                        </p>
                                                        <p className="mt-1 font-bold text-emerald-700">
                                                            {question.correctOptionId || "-"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                            Marks
                                                        </p>
                                                        <p className="mt-1 font-bold">
                                                            {question.studentAnswer?.marksAwarded ?? 0}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                            Time
                                                        </p>
                                                        <p className="mt-1 font-bold">
                                                            {formatSeconds(question.studentAnswer?.timeSpentSeconds || 0)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {question.explanationEn || question.explanationHi ? (
                                                    <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950 ring-1 ring-emerald-100">
                                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                                            Explanation
                                                        </p>
                                                        {renderOptionalText(
                                                            question.explanationEn,
                                                            question.explanationHi
                                                        )}
                                                    </div>
                                                ) : null}

                                                {question.explanationImageUrl ? (
                                                    <figure className="mt-4">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={question.explanationImageUrl}
                                                            alt="Explanation image"
                                                            className="max-h-80 rounded-xl object-contain ring-1 ring-slate-200"
                                                        />
                                                    </figure>
                                                ) : null}
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </>
                ) : (
                    <section className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
                        <h2 className="text-xl font-bold">Review not loaded yet</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Login as a student to fetch detailed review.
                        </p>
                    </section>
                )}
            </div>
        </main>
    );
}
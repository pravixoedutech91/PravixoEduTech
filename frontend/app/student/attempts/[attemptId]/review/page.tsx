"use client";

import { secureLogout } from "../../../../../lib/secureLogout";
import StudentPortalShell, { type StudentPortalProfile } from "@/components/student/StudentPortalShell";

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
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:5000";

const STUDENT_TOKEN_STORAGE_KEY = "pravixoStudentToken";
const STUDENT_PROFILE_STORAGE_KEY = "pravixoStudentProfile";

const getStoredStudentPortalProfile = (): StudentPortalProfile | null => {
    if (typeof window === "undefined") {
        return null;
    }

    const rawProfile = window.localStorage.getItem(
        STUDENT_PROFILE_STORAGE_KEY
    );

    if (!rawProfile) {
        return null;
    }

    try {
        const parsedProfile = JSON.parse(
            rawProfile
        ) as StudentPortalProfile;

        return parsedProfile &&
            typeof parsedProfile === "object"
            ? parsedProfile
            : null;
    } catch {
        return null;
    }
};
const ACTIVE_ATTEMPT_STORAGE_KEY = "pravixoActiveAttempt";
const ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY = "pravixoActiveAttemptPayload";
const ACTIVE_ATTEMPT_POSITION_STORAGE_KEY = "pravixoActiveAttemptPosition";

const INVALID_STUDENT_SESSION_MESSAGE =
    "Your student session has expired or was invalidated. Please login again.";

const clearStudentSessionStorage = () => {
    window.localStorage.removeItem(STUDENT_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STUDENT_PROFILE_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_ATTEMPT_POSITION_STORAGE_KEY);
};

const isInvalidStudentSessionResponse = (
    response: Response,
    message?: string
) => {
    const normalizedMessage = (message || "").toLowerCase();

    return (
        response.status === 401 ||
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
    isCorrect: boolean | null;
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
    evaluationStatus?: "scored" | "officially_cancelled" | "source_ambiguous";
    isScored?: boolean;
    evaluationNoteEn?: string;
    evaluationNoteHi?: string;
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
    if (question.evaluationStatus === "officially_cancelled") {
        return "Officially Cancelled";
    }

    if (question.evaluationStatus === "source_ambiguous") {
        return "Source Ambiguous";
    }
    if (!question.studentAnswer) {
        return "Not visited";
    }

    if (
        question.studentAnswer.status === "skipped" ||
        !question.studentAnswer.selectedOptionId
    ) {
        return "Skipped";
    }

    if (question.studentAnswer.isCorrect) {
        return "Correct";
    }

    return "Wrong";
};

const getQuestionStatusClassName = (question: ReviewQuestion) => {
    if (question.evaluationStatus === "officially_cancelled") {
        return "bg-amber-50 text-amber-800 ring-amber-200";
    }

    if (question.evaluationStatus === "source_ambiguous") {
        return "bg-violet-50 text-violet-800 ring-violet-200";
    }
    const answer = question.studentAnswer;

    if (
        !answer ||
        answer.status === "skipped" ||
        !answer.selectedOptionId
    ) {
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
    isScored,
}: {
    isCorrectOption: boolean;
    isSelectedOption: boolean;
    isScored: boolean;
}) => {
    if (!isScored) {
        return isSelectedOption
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-slate-200 bg-white text-slate-700";
    }

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

    const normalizedReviewMessage = message.trim().toLowerCase();

    const isExpiredReview =
        normalizedReviewMessage.includes("detailed review has expired") ||
        normalizedReviewMessage.includes("already expired");

    const isReviewUnavailable =
        isExpiredReview ||
        normalizedReviewMessage.includes(
            "detailed review is not available"
        ) ||
        normalizedReviewMessage.includes(
            "detailed review will be available"
        );

    const emptyReviewTitle = isExpiredReview
        ? "Detailed review expired"
        : isReviewUnavailable
          ? "Detailed review unavailable"
          : "Review not loaded yet";

    const emptyReviewDescription = isExpiredReview
        ? "Question-level review data is retained for a limited period after submission. Your score and result analytics remain available."
        : isReviewUnavailable
          ? "This detailed review cannot be opened right now. Your score and result analytics remain available."
          : effectiveStudentToken
            ? "Use Refresh Review to try loading the detailed review."
            : "Login as a student to fetch detailed review.";

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

    const handleLogout = async () => {
        const shouldLogout = window.confirm(
            "Are you sure you want to logout? Your saved student session will be cleared."
        );

        if (!shouldLogout) {
            return;
        }

        const logoutResult = await secureLogout(effectiveStudentToken);

        if (!logoutResult.shouldClearLocalSession) {
            setMessage(
                "Secure logout could not be confirmed. Please check your connection and try again."
            );
            return;
        }

        clearStudentSessionStorage();

        setReview(null);
        setMessage("You have been logged out. Please login again.");

        router.push("/student/login");
    };

    return (
        <StudentPortalShell
            profile={
                effectiveStudentToken
                    ? getStoredStudentPortalProfile()
                    : null
            }
            isSyncing={isLoading}
            onLogout={handleLogout}
        >
            <div className="mx-auto max-w-6xl space-y-5 pb-24 text-slate-950 lg:pb-8">
                <section className="border-b border-slate-200 pb-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0 max-w-3xl">
                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">
                                Learning Review
                            </p>

                            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                Detailed Review
                            </h1>

                            <p className="mt-2 text-lg font-bold leading-snug text-slate-800 sm:text-xl">
                                {review?.test.title ||
                                    "Review your test attempt"}
                            </p>

                            {review ? (
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                                    <span>
                                        Attempt #
                                        {review.attempt.attemptNumber || "—"}
                                    </span>

                                    <span aria-hidden="true">•</span>

                                    <span>
                                        Submitted{" "}
                                        {formatDateTime(
                                            review.attempt.submittedAt
                                        )}
                                    </span>
                                </div>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/student/attempts"
                                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                                Back to Attempts
                            </Link>

                            <Link
                                href={`/student/attempts/${attemptId}/result`}
                                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
                            >
                                Back to Result
                            </Link>
                        </div>
                    </div>
                </section>

                {message && review ? (
                    <section
                        role="alert"
                        className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800"
                    >
                        {message}
                    </section>
                ) : null}

                {review && summary ? (
                    <>
                        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Review Summary
                                </p>

                                <h2 className="mt-1 text-xl font-black text-slate-950">
                                    Your attempt at a glance
                                </h2>
                            </div>

                            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-6">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                        Score
                                    </p>
                                    <p className="mt-2 text-lg font-black text-slate-950">
                                        {summary.score} / {summary.maxScore}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                        Accuracy
                                    </p>
                                    <p className="mt-2 text-lg font-black text-blue-700">
                                        {formatPercent(summary.accuracy)}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                                        Correct
                                    </p>
                                    <p className="mt-2 text-lg font-black text-emerald-700">
                                        {summary.correct}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-700">
                                        Wrong
                                    </p>
                                    <p className="mt-2 text-lg font-black text-rose-700">
                                        {summary.wrong}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                        Skipped
                                    </p>
                                    <p className="mt-2 text-lg font-black text-slate-700">
                                        {summary.skipped}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                        Time
                                    </p>
                                    <p className="mt-2 text-lg font-black text-slate-950">
                                        {formatSeconds(
                                            review.attempt.timeSpentSeconds
                                        )}
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">
                                        Question-by-Question
                                    </p>

                                    <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                                        Question Review
                                    </h2>

                                    <p className="mt-2 text-sm text-slate-500">
                                        {totalReviewQuestions}{" "}
                                        {totalReviewQuestions === 1
                                            ? "question"
                                            : "questions"}{" "}
                                        reviewed
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                                    Submitted{" "}
                                    <span className="font-bold text-slate-900">
                                        {formatDateTime(
                                            review.attempt.submittedAt
                                        )}
                                    </span>
                                </div>
                            </div>
                        </section>

                        {review.sections.map((section) => (
                            <section
                                key={section.sectionSlug}
                                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
                            >
                                <div className="border-b border-slate-100 pb-5">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">
                                                Section
                                            </p>

                                            <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                                                {section.name}
                                            </h2>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
                                                {section.sectionType.toUpperCase()}
                                            </span>

                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
                                                {section.durationMinutes} min
                                            </span>

                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
                                                {section.questionCount}{" "}
                                                questions
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {(section.questionGroups || []).length >
                                0 ? (
                                    <div className="mt-5 space-y-4">
                                        {(section.questionGroups || []).map(
                                            (group) => (
                                                <article
                                                    key={
                                                        group.questionGroupId
                                                    }
                                                    className="rounded-3xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5"
                                                >
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                                                            {group.groupType}
                                                        </span>

                                                        {group.topic ? (
                                                            <span className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                                                                {group.topic}
                                                            </span>
                                                        ) : null}
                                                    </div>

                                                    <h3 className="mt-4 text-lg font-black text-slate-950">
                                                        {group.title}
                                                    </h3>

                                                    <div className="mt-3 text-sm leading-6 text-slate-700">
                                                        {renderOptionalText(
                                                            group.instructionEn,
                                                            group.instructionHi
                                                        )}
                                                    </div>

                                                    <div className="mt-4 space-y-3">
                                                        {(
                                                            group.contentBlocks ||
                                                            []
                                                        ).map(
                                                            renderContentBlock
                                                        )}
                                                    </div>
                                                </article>
                                            )
                                        )}
                                    </div>
                                ) : null}

                                <div className="mt-5 space-y-5">
                                    {(section.questions || []).map(
                                        (question) => {
                                            const questionNumber =
                                                questionNumberMap.get(
                                                    question._id
                                                ) || question.order;

                                            const selectedOptionId =
                                                question.studentAnswer
                                                    ?.selectedOptionId ||
                                                null;

                                            const isScoredQuestion =
                                                question.isScored !== false &&
                                                (question.evaluationStatus ||
                                                    "scored") === "scored";

                                            const linkedGroup = (
                                                section.questionGroups || []
                                            ).find(
                                                (group) =>
                                                    group.questionGroupId ===
                                                    question.questionGroupId
                                            );

                                            return (
                                                <article
                                                    key={question._id}
                                                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                                                >
                                                    <div className="p-4 sm:p-5">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">
                                                                Question{" "}
                                                                {questionNumber}
                                                            </span>

                                                            <span
                                                                className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${getQuestionStatusClassName(
                                                                    question
                                                                )}`}
                                                            >
                                                                {getQuestionStatusLabel(
                                                                    question
                                                                )}
                                                            </span>

                                                            {isScoredQuestion ? (
                                                                <>
                                                                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                                                        +
                                                                        {
                                                                            question.marks
                                                                        }{" "}
                                                                        marks
                                                                    </span>

                                                                    <span className="rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                                                                        −
                                                                        {
                                                                            question.negativeMarks
                                                                        }
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                                                                    Unscored
                                                                </span>
                                                            )}

                                                            {linkedGroup ? (
                                                                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                                                    {linkedGroup.topic ||
                                                                        linkedGroup.title}
                                                                </span>
                                                            ) : null}
                                                        </div>

                                                        <div className="mt-5 space-y-2 text-base font-semibold leading-7 text-slate-950 sm:text-lg">
                                                            {renderOptionalText(
                                                                question.questionTextEn,
                                                                question.questionTextHi
                                                            )}
                                                        </div>

                                                        {question.questionImageUrl ? (
                                                            <figure className="mt-4">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={
                                                                        question.questionImageUrl
                                                                    }
                                                                    alt="Question image"
                                                                    className="max-h-80 rounded-2xl object-contain ring-1 ring-slate-200"
                                                                />
                                                            </figure>
                                                        ) : null}

                                                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                                                            {(
                                                                question.options ||
                                                                []
                                                            ).map(
                                                                (option) => {
                                                                    const isCorrectOption =
                                                                        isScoredQuestion &&
                                                                        option.optionId ===
                                                                            question.correctOptionId;

                                                                    const isSelectedOption =
                                                                        option.optionId ===
                                                                        selectedOptionId;

                                                                    return (
                                                                        <div
                                                                            key={
                                                                                option.optionId
                                                                            }
                                                                            className={`rounded-2xl border p-4 ${getOptionClassName(
                                                                                {
                                                                                    isCorrectOption,
                                                                                    isSelectedOption,
                                                                                    isScored:
                                                                                        isScoredQuestion,
                                                                                }
                                                                            )}`}
                                                                        >
                                                                            <div className="flex items-start gap-3">
                                                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black ring-1 ring-current">
                                                                                    {
                                                                                        option.optionId
                                                                                    }
                                                                                </span>

                                                                                <div className="min-w-0 flex-1">
                                                                                    <p className="font-semibold leading-6">
                                                                                        {option.textEn ||
                                                                                            option.textHi ||
                                                                                            "—"}
                                                                                    </p>

                                                                                    {option.textHi &&
                                                                                    option.textHi !==
                                                                                        option.textEn ? (
                                                                                        <p className="mt-1 text-sm leading-6 opacity-80">
                                                                                            {
                                                                                                option.textHi
                                                                                            }
                                                                                        </p>
                                                                                    ) : null}

                                                                                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                                                                                        {isCorrectOption ? (
                                                                                            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-white">
                                                                                                Correct
                                                                                                Answer
                                                                                            </span>
                                                                                        ) : null}

                                                                                        {isSelectedOption ? (
                                                                                            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-white">
                                                                                                Your
                                                                                                Answer
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                            )}
                                                        </div>

                                                        {!isScoredQuestion &&
                                                        (question.evaluationNoteEn ||
                                                            question.evaluationNoteHi) ? (
                                                            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                                                                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-800">
                                                                    Evaluation
                                                                    Note
                                                                </p>

                                                                {renderOptionalText(
                                                                    question.evaluationNoteEn,
                                                                    question.evaluationNoteHi
                                                                )}
                                                            </div>
                                                        ) : null}

                                                        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm sm:grid-cols-4">
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                                    Your Answer
                                                                </p>

                                                                <p className="mt-1 font-black text-slate-950">
                                                                    {selectedOptionId ||
                                                                        "Skipped"}
                                                                </p>
                                                            </div>

                                                            {isScoredQuestion ? (
                                                                <div>
                                                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                                        Correct
                                                                        Answer
                                                                    </p>

                                                                    <p className="mt-1 font-black text-emerald-700">
                                                                        {question.correctOptionId ||
                                                                            "—"}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                                        Scoring
                                                                    </p>

                                                                    <p className="mt-1 font-black text-amber-700">
                                                                        Not
                                                                        Scored
                                                                    </p>
                                                                </div>
                                                            )}

                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                                    Marks
                                                                </p>

                                                                <p className="mt-1 font-black text-slate-950">
                                                                    {question
                                                                        .studentAnswer
                                                                        ?.marksAwarded ??
                                                                        0}
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                                    Time
                                                                </p>

                                                                <p className="mt-1 font-black text-slate-950">
                                                                    {formatSeconds(
                                                                        question
                                                                            .studentAnswer
                                                                            ?.timeSpentSeconds ||
                                                                            0
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {isScoredQuestion &&
                                                        (question.explanationEn ||
                                                            question.explanationHi) ? (
                                                            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                                                                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                                                                    Explanation
                                                                </p>

                                                                {renderOptionalText(
                                                                    question.explanationEn,
                                                                    question.explanationHi
                                                                )}
                                                            </div>
                                                        ) : null}

                                                        {isScoredQuestion &&
                                                        question.explanationImageUrl ? (
                                                            <figure className="mt-4">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={
                                                                        question.explanationImageUrl
                                                                    }
                                                                    alt="Explanation image"
                                                                    className="max-h-80 rounded-2xl object-contain ring-1 ring-slate-200"
                                                                />
                                                            </figure>
                                                        ) : null}
                                                    </div>
                                                </article>
                                            );
                                        }
                                    )}
                                </div>
                            </section>
                        ))}
                    </>
                ) : isLoading ? (
                    <section
                        aria-live="polite"
                        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                    >
                        <div className="animate-pulse">
                            <div className="h-4 w-32 rounded bg-slate-100" />
                            <div className="mt-4 h-8 w-64 max-w-full rounded bg-slate-100" />

                            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="h-20 rounded-2xl bg-slate-100" />
                                <div className="h-20 rounded-2xl bg-slate-100" />
                                <div className="h-20 rounded-2xl bg-slate-100" />
                                <div className="h-20 rounded-2xl bg-slate-100" />
                            </div>
                        </div>
                    </section>
                ) : (
                    <section className="rounded-3xl border border-slate-200 bg-white px-5 py-10 text-center shadow-sm sm:px-8">
                        <div
                            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${
                                isExpiredReview
                                    ? "bg-amber-50 text-amber-700"
                                    : isReviewUnavailable
                                      ? "bg-slate-100 text-slate-600"
                                      : "bg-blue-50 text-blue-700"
                            }`}
                        >
                            {isExpiredReview
                                ? "!"
                                : isReviewUnavailable
                                  ? "—"
                                  : "?"}
                        </div>

                        <h2 className="mt-4 text-xl font-black text-slate-950">
                            {emptyReviewTitle}
                        </h2>

                        {message ? (
                            <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold text-slate-700">
                                {message}
                            </p>
                        ) : null}

                        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                            {isExpiredReview ||
                            isReviewUnavailable ||
                            !effectiveStudentToken
                                ? emptyReviewDescription
                                : "Detailed review could not be loaded. Reload this page to try again."}
                        </p>

                        <div className="mt-6 flex flex-wrap justify-center gap-3">
                            <Link
                                href={`/student/attempts/${attemptId}/result`}
                                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                            >
                                Back to Result
                            </Link>

                            {!effectiveStudentToken ? (
                                <Link
                                    href="/student/login"
                                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                                >
                                    Login
                                </Link>
                            ) : null}
                        </div>
                    </section>
                )}
            </div>
        </StudentPortalShell>
    );
}

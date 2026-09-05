"use client";

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
const STUDENT_TOKEN_KEY = "pravixoStudentToken";
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
    window.localStorage.removeItem(STUDENT_TOKEN_KEY);
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
    scorableQuestions?: number;
    unscoredQuestions?: number;
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

type SectionSummary = ScoreSummary & {
    sectionSlug?: string;
    name: string;
    sectionType?: string;
    timeSpentSeconds?: number;
};

type TopicSummary = ScoreSummary & {
    subject?: string;
    topic?: string;
    subTopic?: string;
    timeSpentSeconds?: number;
};

type DifficultySummary = ScoreSummary & {
    difficulty: string;
    timeSpentSeconds?: number;
};

type ResultPayload = {
    serverTime: string;
    resultAvailable: boolean;
    test: {
        _id: string;
        mockTestId: string;
        versionNumber: number;
        title: string;
        slug: string;
        testType: string;
        accessType: string;
        examPattern?: {
            name?: string;
            examType?: string;
            totalDurationMinutes?: number;
        };
    };
    attempt: {
        _id: string;
        attemptNumber: number;
        status: string;
        startedAt: string;
        submittedAt?: string | null;
        expiresAt?: string | null;
        totalDurationSeconds?: number;
        timeSpentSeconds?: number;
        scoreSummary: ScoreSummary;
        sectionSummaries: SectionSummary[];
        topicSummaries: TopicSummary[];
        difficultySummaries: DifficultySummary[];
        review?: {
            isDetailedReviewAvailable: boolean;
            detailedReviewExpiresAt?: string | null;
            solutionVisibility?: string | null;
            reviewRetentionDays?: number;
        };
    };
};

type ResultApiResponse = {
    success: boolean;
    message?: string;
    data?: ResultPayload;
};

const getDetailedReviewUnavailableMessage = (
    review:
        | {
              detailedReviewExpiresAt?: string | null;
              solutionVisibility?: string | null;
          }
        | null
        | undefined
) => {
    if (review?.solutionVisibility === "never") {
        return "Detailed review is not available for this test.";
    }

    const expiryTime = review?.detailedReviewExpiresAt
        ? new Date(review.detailedReviewExpiresAt).getTime()
        : Number.NaN;

    if (Number.isFinite(expiryTime) && expiryTime <= Date.now()) {
        return "Detailed review has expired.";
    }

    return "Detailed review is not available yet.";
};

const numberOrZero = (value: number | null | undefined) => Number(value || 0);

const formatPercent = (value: number | null | undefined) => {
    return `${numberOrZero(value).toFixed(2).replace(/\.00$/, "")}%`;
};

const formatScore = (value: number | null | undefined) => {
    return numberOrZero(value).toFixed(2).replace(/\.00$/, "");
};

const formatDateTime = (value?: string | null) => {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
};

const formatDuration = (seconds?: number | null) => {
    const totalSeconds = Math.max(numberOrZero(seconds), 0);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    if (minutes <= 0) return `${remainingSeconds}s`;

    return `${minutes}m ${remainingSeconds}s`;
};

const getStudentToken = () => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STUDENT_TOKEN_KEY) || "";
};

const getEmptyServerSnapshot = () => "";

const subscribeToStudentToken = (callback: () => void) => {
    if (typeof window === "undefined") return () => {};

    window.addEventListener("storage", callback);

    return () => {
        window.removeEventListener("storage", callback);
    };
};

const SummaryStat = ({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) => {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
    );
};

const MiniStat = ({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) => {
    return (
        <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
        </div>
    );
};

export default function StudentAttemptResultPage() {
    const router = useRouter();
    const params = useParams<{ attemptId?: string | string[] }>();
    const attemptId = Array.isArray(params.attemptId)
        ? params.attemptId[0]
        : params.attemptId;

    const [result, setResult] = useState<ResultPayload | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const storedStudentToken = useSyncExternalStore(
        subscribeToStudentToken,
        getStudentToken,
        getEmptyServerSnapshot
    );
    const effectiveStudentToken = storedStudentToken.trim();
    const autoLoadKeyRef = useRef("");

    const fetchResult = useCallback(async () => {
        if (!attemptId) {
            setErrorMessage("Attempt ID is missing from the URL.");
            return;
        }

        const token = effectiveStudentToken;

        if (!token) {
            setErrorMessage("Please login as a student first to load result.");
            return;
        }

        setIsLoading(true);
        setErrorMessage("");

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/student/attempts/${attemptId}/result`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const payload = (await response.json()) as ResultApiResponse;

            if (isInvalidStudentSessionResponse(response, payload.message)) {
                clearStudentSessionStorage();
                setResult(null);
                setErrorMessage(INVALID_STUDENT_SESSION_MESSAGE);
                router.push("/student/login");
                return;
            }

            if (!response.ok || !payload.success || !payload.data) {
                throw new Error(payload.message || "Unable to load result.");
            }

            setResult(payload.data);
        } catch (error) {
            setResult(null);
            setErrorMessage(
                error instanceof Error ? error.message : "Unable to load result."
            );
        } finally {
            setIsLoading(false);
        }
    }, [attemptId, effectiveStudentToken, router]);

    useEffect(() => {
        if (!attemptId || !effectiveStudentToken) return;

        const autoLoadKey = `${attemptId}:${effectiveStudentToken.slice(-12)}`;

        if (autoLoadKeyRef.current === autoLoadKey) return;

        autoLoadKeyRef.current = autoLoadKey;

        void fetchResult();
    }, [attemptId, effectiveStudentToken, fetchResult]);

    const handleLogout = () => {
        const shouldLogout = window.confirm(
            "Are you sure you want to logout? Your saved student session will be cleared."
        );

        if (!shouldLogout) {
            return;
        }

        clearStudentSessionStorage();

        setResult(null);
        setErrorMessage("You have been logged out. Please login again.");

        router.push("/student/login");
    };

    const scoreSummary = result?.attempt.scoreSummary;

    const resultStatusLabel = useMemo(() => {
        if (!result) return "Result";
        return result.resultAvailable ? "Result Available" : "Result Locked";
    }, [result]);

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
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">
                                    Performance
                                </p>

                                {result ? (
                                    <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
                                        {resultStatusLabel}
                                    </span>
                                ) : null}
                            </div>

                            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                Test Result
                            </h1>

                            <p className="mt-2 text-lg font-bold leading-snug text-slate-800 sm:text-xl">
                                {result?.test.title || "Your test performance"}
                            </p>

                            {result ? (
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                                    <span>
                                        Attempt #
                                        {result.attempt.attemptNumber || "—"}
                                    </span>

                                    <span aria-hidden="true">•</span>

                                    <span>
                                        Completed{" "}
                                        {formatDateTime(
                                            result.attempt.submittedAt
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

                            {attemptId &&
                            result?.attempt.review
                                ?.isDetailedReviewAvailable ? (
                                <Link
                                    href={`/student/attempts/${attemptId}/review`}
                                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
                                >
                                    Detailed Review
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </section>

                {errorMessage ? (
                    <section
                        role="alert"
                        className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700"
                    >
                        <p>{errorMessage}</p>

                        {!effectiveStudentToken ? (
                            <Link
                                href="/student/login"
                                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                            >
                                Login
                            </Link>
                        ) : null}
                    </section>
                ) : null}

                {!result && !errorMessage ? (
                    <section
                        aria-live="polite"
                        className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
                    >
                        {isLoading ? (
                            <div className="animate-pulse">
                                <div className="h-4 w-28 rounded bg-slate-100" />
                                <div className="mt-4 h-8 w-64 max-w-full rounded bg-slate-100" />

                                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="h-24 rounded-2xl bg-slate-100" />
                                    <div className="h-24 rounded-2xl bg-slate-100" />
                                    <div className="h-24 rounded-2xl bg-slate-100" />
                                    <div className="h-24 rounded-2xl bg-slate-100" />
                                </div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <h2 className="text-xl font-black text-slate-950">
                                    Result not loaded
                                </h2>

                                <p className="mt-2 text-sm text-slate-600">
                                    {effectiveStudentToken
                                        ? "Your result will appear here when it is available."
                                        : "Login as a student to view this result."}
                                </p>

                                {!effectiveStudentToken ? (
                                    <Link
                                        href="/student/login"
                                        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                                    >
                                        Login
                                    </Link>
                                ) : null}
                            </div>
                        )}
                    </section>
                ) : null}

                {result && scoreSummary ? (
                    <>
                        <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
                            <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-slate-50 px-5 py-5 sm:px-6">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
                                            Performance Summary
                                        </p>

                                        <h2 className="mt-1 text-xl font-black text-slate-950">
                                            Your result at a glance
                                        </h2>
                                    </div>

                                    <p className="text-sm font-semibold text-slate-500">
                                        Attempt #
                                        {result.attempt.attemptNumber || "—"}
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
                                <SummaryStat
                                    label="Score"
                                    value={`${formatScore(
                                        scoreSummary.score
                                    )} / ${formatScore(
                                        scoreSummary.maxScore
                                    )}`}
                                />

                                <SummaryStat
                                    label="Percentage"
                                    value={formatPercent(
                                        scoreSummary.percentage
                                    )}
                                />

                                <SummaryStat
                                    label="Accuracy"
                                    value={formatPercent(
                                        scoreSummary.accuracy
                                    )}
                                />

                                <SummaryStat
                                    label="Time Spent"
                                    value={formatDuration(
                                        result.attempt.timeSpentSeconds
                                    )}
                                />
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Attempt Snapshot
                                </p>

                                <h2 className="mt-1 text-xl font-black text-slate-950">
                                    Question breakdown
                                </h2>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <MiniStat
                                    label="Attempted"
                                    value={scoreSummary.attempted}
                                />

                                <MiniStat
                                    label="Correct"
                                    value={scoreSummary.correct}
                                />

                                <MiniStat
                                    label="Wrong"
                                    value={scoreSummary.wrong}
                                />

                                <MiniStat
                                    label="Skipped"
                                    value={scoreSummary.skipped}
                                />
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <MiniStat
                                    label="Total Questions"
                                    value={scoreSummary.totalQuestions}
                                />

                                <MiniStat
                                    label="Scorable Questions"
                                    value={
                                        scoreSummary.scorableQuestions ??
                                        scoreSummary.totalQuestions
                                    }
                                />

                                <MiniStat
                                    label="Unscored Questions"
                                    value={
                                        scoreSummary.unscoredQuestions ?? 0
                                    }
                                />
                            </div>

                            {(scoreSummary.unscoredQuestions ?? 0) > 0 ? (
                                <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 ring-1 ring-amber-100">
                                    Unscored questions remain part of the
                                    paper but are excluded from score,
                                    accuracy and maximum-score calculations.
                                </p>
                            ) : null}

                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <MiniStat
                                    label="Negative Marks"
                                    value={formatScore(
                                        scoreSummary.negativeMarks
                                    )}
                                />

                                <MiniStat
                                    label="Started"
                                    value={formatDateTime(
                                        result.attempt.startedAt
                                    )}
                                />

                                <MiniStat
                                    label="Submitted"
                                    value={formatDateTime(
                                        result.attempt.submittedAt
                                    )}
                                />
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Section Performance
                                </p>

                                <h2 className="mt-1 text-xl font-black text-slate-950">
                                    Section Analysis
                                </h2>
                            </div>

                            <div className="mt-5 grid gap-3">
                                {result.attempt.sectionSummaries.map(
                                    (section) => (
                                        <article
                                            key={
                                                section.sectionSlug ||
                                                section.name
                                            }
                                            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"
                                        >
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                <div className="min-w-0">
                                                    <h3 className="font-black text-slate-950">
                                                        {section.name}
                                                    </h3>

                                                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                                        {section.sectionType ||
                                                            "Section"}
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
                                                    <MiniStat
                                                        label="Score"
                                                        value={`${formatScore(
                                                            section.score
                                                        )} / ${formatScore(
                                                            section.maxScore
                                                        )}`}
                                                    />

                                                    <MiniStat
                                                        label="Percentage"
                                                        value={formatPercent(
                                                            section.percentage
                                                        )}
                                                    />

                                                    <MiniStat
                                                        label="Accuracy"
                                                        value={formatPercent(
                                                            section.accuracy
                                                        )}
                                                    />

                                                    <MiniStat
                                                        label="Time"
                                                        value={formatDuration(
                                                            section.timeSpentSeconds
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </article>
                                    )
                                )}
                            </div>
                        </section>

                        <section className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                        By Topic
                                    </p>

                                    <h2 className="mt-1 text-xl font-black text-slate-950">
                                        Topic Analysis
                                    </h2>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {result.attempt.topicSummaries.map(
                                        (topic, index) => (
                                            <article
                                                key={`${topic.subject}-${topic.topic}-${index}`}
                                                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                                            >
                                                <h3 className="font-black text-slate-950">
                                                    {topic.topic ||
                                                        "General"}
                                                </h3>

                                                <p className="mt-1 text-xs text-slate-500">
                                                    {topic.subject ||
                                                        "Subject"}
                                                    {topic.subTopic
                                                        ? ` • ${topic.subTopic}`
                                                        : ""}
                                                </p>

                                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                    <MiniStat
                                                        label="Score"
                                                        value={`${formatScore(
                                                            topic.score
                                                        )} / ${formatScore(
                                                            topic.maxScore
                                                        )}`}
                                                    />

                                                    <MiniStat
                                                        label="Accuracy"
                                                        value={formatPercent(
                                                            topic.accuracy
                                                        )}
                                                    />

                                                    <MiniStat
                                                        label="Time"
                                                        value={formatDuration(
                                                            topic.timeSpentSeconds
                                                        )}
                                                    />
                                                </div>
                                            </article>
                                        )
                                    )}
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                        By Difficulty
                                    </p>

                                    <h2 className="mt-1 text-xl font-black text-slate-950">
                                        Difficulty Analysis
                                    </h2>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {result.attempt.difficultySummaries.map(
                                        (difficulty) => (
                                            <article
                                                key={
                                                    difficulty.difficulty
                                                }
                                                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                                            >
                                                <h3 className="font-black capitalize text-slate-950">
                                                    {difficulty.difficulty ||
                                                        "Not marked"}
                                                </h3>

                                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                    <MiniStat
                                                        label="Score"
                                                        value={`${formatScore(
                                                            difficulty.score
                                                        )} / ${formatScore(
                                                            difficulty.maxScore
                                                        )}`}
                                                    />

                                                    <MiniStat
                                                        label="Accuracy"
                                                        value={formatPercent(
                                                            difficulty.accuracy
                                                        )}
                                                    />

                                                    <MiniStat
                                                        label="Time"
                                                        value={formatDuration(
                                                            difficulty.timeSpentSeconds
                                                        )}
                                                    />
                                                </div>
                                            </article>
                                        )
                                    )}
                                </div>
                            </div>
                        </section>

                        <section
                            className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${
                                result.attempt.review
                                    ?.isDetailedReviewAvailable
                                    ? "border-emerald-200 bg-emerald-50"
                                    : "border-slate-200 bg-white"
                            }`}
                        >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="max-w-3xl">
                                    <p
                                        className={`text-[11px] font-bold uppercase tracking-[0.2em] ${
                                            result.attempt.review
                                                ?.isDetailedReviewAvailable
                                                ? "text-emerald-700"
                                                : "text-slate-400"
                                        }`}
                                    >
                                        Learn From Your Attempt
                                    </p>

                                    <h2
                                        className={`mt-1 text-xl font-black ${
                                            result.attempt.review
                                                ?.isDetailedReviewAvailable
                                                ? "text-emerald-950"
                                                : "text-slate-950"
                                        }`}
                                    >
                                        Detailed Review
                                    </h2>

                                    <p
                                        className={`mt-2 text-sm leading-6 ${
                                            result.attempt.review
                                                ?.isDetailedReviewAvailable
                                                ? "text-emerald-800"
                                                : "text-slate-600"
                                        }`}
                                    >
                                        {result.attempt.review
                                            ?.isDetailedReviewAvailable
                                            ? `Review your answers and solutions until ${formatDateTime(
                                                  result.attempt.review
                                                      .detailedReviewExpiresAt
                                              )}.`
                                            : getDetailedReviewUnavailableMessage(
                                                  result.attempt.review
                                              )}
                                    </p>
                                </div>

                                {attemptId &&
                                result.attempt.review
                                    ?.isDetailedReviewAvailable ? (
                                    <Link
                                        href={`/student/attempts/${attemptId}/review`}
                                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                                    >
                                        Open Detailed Review
                                    </Link>
                                ) : null}
                            </div>
                        </section>
                    </>
                ) : null}
            </div>
        </StudentPortalShell>
    );
}

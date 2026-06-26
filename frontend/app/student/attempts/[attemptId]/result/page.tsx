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
const STUDENT_TOKEN_KEY = "pravixoStudentToken";
const STUDENT_PROFILE_STORAGE_KEY = "pravixoStudentProfile";
const ACTIVE_ATTEMPT_STORAGE_KEY = "pravixoActiveAttempt";
const ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY = "pravixoActiveAttemptPayload";

const INVALID_STUDENT_SESSION_MESSAGE =
    "Your student session has expired or was invalidated. Please login again.";

const clearStudentSessionStorage = () => {
    window.localStorage.removeItem(STUDENT_TOKEN_KEY);
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
        <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                                {resultStatusLabel}
                            </p>
                            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                                {result?.test.title || "Mock Test Result"}
                            </h1>
                            <p className="mt-2 text-sm text-slate-600">
                                Attempt #{result?.attempt.attemptNumber || "--"} | Version{" "}
                                {result?.test.versionNumber || "--"} |{" "}
                                {result?.attempt.status || "loading"}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Link
                                href="/student/mock-tests"
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                            >
                                Back to Mock Tests
                            </Link>

                            {attemptId ? (
                                <Link
                                    href={`/student/attempts/${attemptId}/review`}
                                    className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                                >
                                    View Detailed Review
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </header>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                                Student Session
                            </p>

                            <h2 className="mt-2 text-xl font-bold text-slate-950">
                                Result Access
                            </h2>

                            <p className="mt-2 text-sm text-slate-600">
                                {effectiveStudentToken
                                    ? "You are logged in. Result loads using your saved student session."
                                    : "Please login first to view this result."}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {effectiveStudentToken ? (
                                <button
                                    type="button"
                                    onClick={() => void fetchResult()}
                                    disabled={isLoading}
                                    className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                    {isLoading ? "Loading..." : "Refresh Result"}
                                </button>
                            ) : (
                                <Link
                                    href="/student/login"
                                    className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                                >
                                    Login
                                </Link>
                            )}

                            {effectiveStudentToken ? (
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="rounded-2xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                                >
                                    Logout
                                </button>
                            ) : null}
                        </div>
                    </div>
                </section>

                {errorMessage ? (
                    <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
                        {errorMessage}
                    </section>
                ) : null}

                {!result && !errorMessage ? (
                    <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
                        {isLoading ? "Loading result..." : "Result will appear here."}
                    </section>
                ) : null}

                {result && scoreSummary ? (
                    <>
                        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <SummaryStat
                                label="Score"
                                value={`${formatScore(scoreSummary.score)} / ${formatScore(
                                    scoreSummary.maxScore
                                )}`}
                            />
                            <SummaryStat
                                label="Percentage"
                                value={formatPercent(scoreSummary.percentage)}
                            />
                            <SummaryStat
                                label="Accuracy"
                                value={formatPercent(scoreSummary.accuracy)}
                            />
                            <SummaryStat
                                label="Time Spent"
                                value={formatDuration(result.attempt.timeSpentSeconds)}
                            />
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-black text-slate-950">
                                Attempt Summary
                            </h2>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                <MiniStat
                                    label="Total Questions"
                                    value={scoreSummary.totalQuestions}
                                />
                                <MiniStat label="Attempted" value={scoreSummary.attempted} />
                                <MiniStat label="Correct" value={scoreSummary.correct} />
                                <MiniStat label="Wrong" value={scoreSummary.wrong} />
                                <MiniStat label="Skipped" value={scoreSummary.skipped} />
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <MiniStat
                                    label="Negative Marks"
                                    value={formatScore(scoreSummary.negativeMarks)}
                                />
                                <MiniStat
                                    label="Started At"
                                    value={formatDateTime(result.attempt.startedAt)}
                                />
                                <MiniStat
                                    label="Submitted At"
                                    value={formatDateTime(result.attempt.submittedAt)}
                                />
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-black text-slate-950">
                                Section Analysis
                            </h2>
                            <div className="mt-4 grid gap-3">
                                {result.attempt.sectionSummaries.map((section) => (
                                    <div
                                        key={section.sectionSlug || section.name}
                                        className="rounded-2xl border border-slate-200 p-4"
                                    >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div>
                                                <p className="text-base font-bold text-slate-950">
                                                    {section.name}
                                                </p>
                                                <p className="text-xs uppercase tracking-wide text-slate-500">
                                                    {section.sectionType || "section"}
                                                </p>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[520px]">
                                                <MiniStat
                                                    label="Score"
                                                    value={`${formatScore(section.score)} / ${formatScore(
                                                        section.maxScore
                                                    )}`}
                                                />
                                                <MiniStat
                                                    label="Percentage"
                                                    value={formatPercent(section.percentage)}
                                                />
                                                <MiniStat
                                                    label="Accuracy"
                                                    value={formatPercent(section.accuracy)}
                                                />
                                                <MiniStat
                                                    label="Time"
                                                    value={formatDuration(section.timeSpentSeconds)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-black text-slate-950">
                                    Topic Analysis
                                </h2>
                                <div className="mt-4 space-y-3">
                                    {result.attempt.topicSummaries.map((topic, index) => (
                                        <div
                                            key={`${topic.subject}-${topic.topic}-${index}`}
                                            className="rounded-2xl bg-slate-50 p-4"
                                        >
                                            <p className="font-bold text-slate-950">
                                                {topic.topic || "General"}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {topic.subject || "Subject"}
                                                {topic.subTopic ? ` | ${topic.subTopic}` : ""}
                                            </p>
                                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                <MiniStat
                                                    label="Score"
                                                    value={`${formatScore(topic.score)} / ${formatScore(
                                                        topic.maxScore
                                                    )}`}
                                                />
                                                <MiniStat
                                                    label="Accuracy"
                                                    value={formatPercent(topic.accuracy)}
                                                />
                                                <MiniStat
                                                    label="Time"
                                                    value={formatDuration(topic.timeSpentSeconds)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-black text-slate-950">
                                    Difficulty Analysis
                                </h2>
                                <div className="mt-4 space-y-3">
                                    {result.attempt.difficultySummaries.map((difficulty) => (
                                        <div
                                            key={difficulty.difficulty}
                                            className="rounded-2xl bg-slate-50 p-4"
                                        >
                                            <p className="font-bold capitalize text-slate-950">
                                                {difficulty.difficulty || "Not marked"}
                                            </p>
                                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                <MiniStat
                                                    label="Score"
                                                    value={`${formatScore(difficulty.score)} / ${formatScore(
                                                        difficulty.maxScore
                                                    )}`}
                                                />
                                                <MiniStat
                                                    label="Accuracy"
                                                    value={formatPercent(difficulty.accuracy)}
                                                />
                                                <MiniStat
                                                    label="Time"
                                                    value={formatDuration(difficulty.timeSpentSeconds)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                            <h2 className="text-lg font-black text-emerald-950">
                                Detailed Review
                            </h2>
                            <p className="mt-2 text-sm text-emerald-800">
                                {result.attempt.review?.isDetailedReviewAvailable
                                    ? `Detailed review is available until ${formatDateTime(
                                          result.attempt.review.detailedReviewExpiresAt
                                      )}.`
                                    : "Detailed review is not available yet."}
                            </p>
                            {attemptId && result.attempt.review?.isDetailedReviewAvailable ? (
                                <Link
                                    href={`/student/attempts/${attemptId}/review`}
                                    className="mt-4 inline-flex rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                                >
                                    Open Review
                                </Link>
                            ) : null}
                        </section>
                    </>
                ) : null}
            </div>
        </main>
    );
}
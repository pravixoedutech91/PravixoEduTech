"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

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

type AttemptStatus = "in_progress" | "submitted" | "expired" | "abandoned" | string;

type AttemptStatusFilter = "all" | "in_progress" | "submitted" | "expired" | "abandoned";

type ScoreSummary = {
    totalQuestions?: number;
    attemptedQuestions?: number;
    correctAnswers?: number;
    wrongAnswers?: number;
    skippedQuestions?: number;
    score?: number;
    maxScore?: number;
    percentage?: number;
    accuracy?: number;
};

type ReviewSummary = {
    isDetailedReviewAvailable?: boolean;
    detailedReviewExpiresAt?: string | null;
    solutionVisibility?: string | null;
    reviewRetentionDays?: number;
};

type AttemptHistoryItem = {
    attemptId: string;
    mockTestId?: string | null;
    mockTestVersionId?: string | null;
    title?: string | null;
    slug?: string | null;
    versionNumber?: number | null;
    attemptNumber?: number | null;
    status: AttemptStatus;
    startedAt?: string | null;
    submittedAt?: string | null;
    expiresAt?: string | null;
    totalDurationSeconds?: number | null;
    timeSpentSeconds?: number | null;
    isResultVisible?: boolean;
    scoreSummary?: ScoreSummary;
    result?: {
    isResultVisible?: boolean;
};
    review?: ReviewSummary;
};

type AttemptsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    attempts?: AttemptHistoryItem[];
};

const statusLabels: Record<string, string> = {
    in_progress: "In Progress",
    submitted: "Submitted",
    expired: "Expired",
    abandoned: "Abandoned",
};

const statusClasses: Record<string, string> = {
    in_progress: "border-blue-200 bg-blue-50 text-blue-700",
    submitted: "border-emerald-200 bg-emerald-50 text-emerald-700",
    expired: "border-amber-200 bg-amber-50 text-amber-700",
    abandoned: "border-slate-200 bg-slate-100 text-slate-600",
};

const statusFilterOptions: Array<{ label: string; value: AttemptStatusFilter }> = [
    { label: "All", value: "all" },
    { label: "Submitted", value: "submitted" },
    { label: "In Progress", value: "in_progress" },
    { label: "Expired", value: "expired" },
    { label: "Abandoned", value: "abandoned" },
];

const formatDateTime = (value?: string | null) => {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
};

const formatSeconds = (value?: number | null) => {
    if (!value || value <= 0) {
        return "0s";
    }

    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const seconds = Math.floor(value % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
};

const toDisplayNumber = (value?: number | null, suffix = "") => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return `0${suffix}`;
    }

    return `${Math.round(numericValue * 100) / 100}${suffix}`;
};

export default function StudentAttemptsPage() {
    const router = useRouter();
    const [token, setToken] = useState("");
    const [isClientReady, setIsClientReady] = useState(false);
    const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [total, setTotal] = useState(0);
    const [activeStatusFilter, setActiveStatusFilter] =
        useState<AttemptStatusFilter>("all");

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const storedToken =
                window.localStorage.getItem(STUDENT_TOKEN_STORAGE_KEY) || "";

            setToken(storedToken.trim());
            setIsClientReady(true);
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    const cleanToken = useMemo(() => token.trim(), [token]);

    const fetchAttempts = useCallback(async () => {
        setErrorMessage("");
        setSuccessMessage("");

        if (!cleanToken) {
            setAttempts([]);
            setTotal(0);
            setErrorMessage(
                "Student token not found. Please login as a student first."
            );
            return;
        }

        setIsLoading(true);

        try {
            const queryParams = new URLSearchParams({ limit: "20" });

            if (activeStatusFilter !== "all") {
                queryParams.set("status", activeStatusFilter);
            }

            const response = await fetch(
                `${API_BASE_URL}/api/student/mock-tests/my-attempts?${queryParams.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${cleanToken}`,
                    },
                    cache: "no-store",
                }
            );

            const result = (await response.json()) as AttemptsResponse;

            if (isInvalidStudentSessionResponse(response, result.message)) {
                clearStudentSessionStorage();
                setToken("");
                setAttempts([]);
                setTotal(0);
                setSuccessMessage("");
                setErrorMessage(INVALID_STUDENT_SESSION_MESSAGE);
                router.push("/student/login");
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to load attempt history"
                );
            }

            setAttempts(result.attempts || []);
            setTotal(result.total || result.count || 0);
            setSuccessMessage("Attempt history loaded successfully.");
        } catch (error) {
            setAttempts([]);
            setTotal(0);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Unable to load attempt history"
            );
        } finally {
            setIsLoading(false);
        }
    }, [activeStatusFilter, cleanToken, router]);

    useEffect(() => {
        if (!isClientReady || !cleanToken) {
            return;
        }

        const timer = window.setTimeout(() => {
            void fetchAttempts();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [isClientReady, cleanToken, fetchAttempts]);

    const handleLogout = () => {
        const shouldLogout = window.confirm(
            "Are you sure you want to logout? Your saved student session will be cleared."
        );

        if (!shouldLogout) {
            return;
        }

        clearStudentSessionStorage();

        setToken("");
        setAttempts([]);
        setTotal(0);
        setSuccessMessage("");
        setErrorMessage("You have been logged out. Please login again.");

        router.push("/student/login");
    };

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
                                Student Dashboard
                            </p>
                            <h1 className="mt-2 text-3xl font-bold text-slate-950">
                                My Attempts
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-slate-600">
                                View your mock test attempts, check result and
                                review availability, and resume only valid
                                in-progress tests.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/student/mock-tests"
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Back to Mock Tests
                            </Link>

                            {cleanToken ? (
                                <button
                                    type="button"
                                    onClick={fetchAttempts}
                                    disabled={isLoading || !isClientReady}
                                    className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    {isLoading ? "Loading..." : "Refresh Attempts"}
                                </button>
                            ) : (
                                <Link
                                    href="/student/login"
                                    className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                                >
                                    Login
                                </Link>
                            )}

                            {cleanToken ? (
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
                                >
                                    Logout
                                </button>
                            ) : null}
                        </div>

                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                Loaded
                            </p>
                            <p className="mt-2 text-2xl font-bold">
                                {attempts.length}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                Total
                            </p>
                            <p className="mt-2 text-2xl font-bold">{total}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                Security
                            </p>
                            <p className="mt-2 text-sm font-semibold text-emerald-700">
                                Backend expiry sync active
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Filter by status
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {statusFilterOptions.map((option) => {
                                const isActive = activeStatusFilter === option.value;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setActiveStatusFilter(option.value)}
                                        disabled={isLoading}
                                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                            isActive
                                                ? "border-blue-600 bg-blue-600 text-white"
                                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {errorMessage ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                        {errorMessage}
                    </div>
                ) : null}

                {successMessage ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                        {successMessage}
                    </div>
                ) : null}

                {isLoading ? (
                    <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <p className="text-sm font-semibold text-slate-600">
                            Loading attempt history...
                        </p>
                    </section>
                ) : null}

                {!isLoading && attempts.length === 0 ? (
                    <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900">
                            No attempts found
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Start a mock test first. Your attempts will appear
                            here.
                        </p>

                        <Link
                            href="/student/mock-tests"
                            className="mt-5 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            Browse Mock Tests
                        </Link>
                    </section>
                ) : null}

                {!isLoading && attempts.length > 0 ? (
                    <section className="grid gap-4">
                        {attempts.map((attempt) => {
                            const statusClass =
                                statusClasses[attempt.status] ||
                                "border-slate-200 bg-slate-100 text-slate-600";
                            const score = attempt.scoreSummary || {};
                            const canViewResult =
                                attempt.status === "submitted" &&
                                Boolean(attempt.isResultVisible || attempt.result?.isResultVisible);
                            const canViewReview =
                                attempt.status === "submitted" &&
                                Boolean(
                                    attempt.review?.isDetailedReviewAvailable
                                );
                            const canResume =
                                attempt.status === "in_progress" &&
                                Boolean(attempt.attemptId);

                            return (
                                <article
                                    key={attempt.attemptId}
                                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                                >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span
                                                    className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass}`}
                                                >
                                                    {statusLabels[
                                                        attempt.status
                                                    ] || attempt.status}
                                                </span>

                                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                                    Attempt #
                                                    {attempt.attemptNumber ||
                                                        "-"}
                                                </span>

                                                {attempt.versionNumber ? (
                                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                                        Version #
                                                        {attempt.versionNumber}
                                                    </span>
                                                ) : null}
                                            </div>

                                            <h2 className="mt-3 text-xl font-bold text-slate-950">
                                                {attempt.title ||
                                                    "Untitled Mock Test"}
                                            </h2>

                                            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                                                <div>
                                                    <p className="font-semibold text-slate-500">
                                                        Started
                                                    </p>
                                                    <p>
                                                        {formatDateTime(
                                                            attempt.startedAt
                                                        )}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="font-semibold text-slate-500">
                                                        Submitted
                                                    </p>
                                                    <p>
                                                        {formatDateTime(
                                                            attempt.submittedAt
                                                        )}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="font-semibold text-slate-500">
                                                        Expires
                                                    </p>
                                                    <p>
                                                        {formatDateTime(
                                                            attempt.expiresAt
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                        Time
                                                    </p>
                                                    <p className="mt-1 font-bold">
                                                        {formatSeconds(
                                                            attempt.timeSpentSeconds
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                        Score
                                                    </p>
                                                    <p className="mt-1 font-bold">
                                                        {toDisplayNumber(
                                                            score.score
                                                        )}
                                                        /
                                                        {toDisplayNumber(
                                                            score.maxScore
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                        Accuracy
                                                    </p>
                                                    <p className="mt-1 font-bold">
                                                        {toDisplayNumber(
                                                            score.accuracy ?? score.percentage, "%")}
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                        Questions
                                                    </p>
                                                    <p className="mt-1 font-bold">
                                                        {toDisplayNumber(
                                                            score.attemptedQuestions
                                                        )}
                                                        /
                                                        {toDisplayNumber(
                                                            score.totalQuestions
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-3 lg:justify-end">
                                            {canResume ? (
                                                <Link
                                                    href={`/student/attempts/${attempt.attemptId}`}
                                                    className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                                                >
                                                    Resume
                                                </Link>
                                            ) : null}

                                            {canViewResult ? (
                                                <Link
                                                    href={`/student/attempts/${attempt.attemptId}/result`}
                                                    className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                                >
                                                    View Result
                                                </Link>
                                            ) : null}

                                            {canViewReview ? (
                                                <Link
                                                    href={`/student/attempts/${attempt.attemptId}/review`}
                                                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                                                >
                                                    View Review
                                                </Link>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                ) : null}
            </div>
        </main>
    );
}



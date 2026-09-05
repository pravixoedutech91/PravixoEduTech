"use client";

import StudentPortalShell, { type StudentPortalProfile } from "@/components/student/StudentPortalShell";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
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

const ATTEMPTS_PAGE_SIZE = 20;

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
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
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
            setTotalPages(0);
            setErrorMessage(
                "Student token not found. Please login as a student first."
            );
            return;
        }

        setIsLoading(true);

        try {
            const queryParams = new URLSearchParams({
                limit: String(ATTEMPTS_PAGE_SIZE),
                page: String(currentPage),
            });

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
                setTotalPages(0);
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

            const resolvedTotal = result.total ?? result.count ?? 0;
            const resolvedTotalPages =
                result.totalPages ??
                (resolvedTotal > 0
                    ? Math.ceil(resolvedTotal / ATTEMPTS_PAGE_SIZE)
                    : 0);

            setAttempts(result.attempts || []);
            setTotal(resolvedTotal);
            setTotalPages(resolvedTotalPages);
            setSuccessMessage("Attempt history loaded successfully.");
        } catch (error) {
            setAttempts([]);
            setTotal(0);
            setTotalPages(0);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Unable to load attempt history"
            );
        } finally {
            setIsLoading(false);
        }
    }, [activeStatusFilter, cleanToken, currentPage, router]);

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
        setTotalPages(0);
        setSuccessMessage("");
        setErrorMessage("You have been logged out. Please login again.");

        router.push("/student/login");
    };

    return (
        <StudentPortalShell
            profile={
                isClientReady && cleanToken
                    ? getStoredStudentPortalProfile()
                    : null
            }
            isSyncing={isLoading}
            onLogout={handleLogout}
        >
            <div className="mx-auto max-w-6xl space-y-5 pb-24 text-slate-900 lg:pb-8">
                <section className="border-b border-slate-200 pb-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">
                                My Practice
                            </p>

                            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                Attempt History
                            </h1>

                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                                Review past tests, continue active attempts, and
                                revisit available results and detailed solutions.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                    Total Attempts
                                </p>
                                <p className="mt-1 text-xl font-black text-slate-950">
                                    {total}
                                </p>
                            </div>

                            {cleanToken ? (
                                <Link
                                    href="/student/mock-tests"
                                    className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                                >
                                    Browse Tests
                                </Link>
                            ) : (
                                <Link
                                    href="/student/login"
                                    className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                                >
                                    Login
                                </Link>
                            )}
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Test History
                            </p>
                            <h2 className="mt-1 text-lg font-black text-slate-950">
                                Filter your attempts
                            </h2>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {statusFilterOptions.map((option) => {
                                const isActive =
                                    activeStatusFilter === option.value;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            if (
                                                activeStatusFilter ===
                                                option.value
                                            ) {
                                                return;
                                            }

                                            setCurrentPage(1);
                                            setActiveStatusFilter(option.value);
                                        }}
                                        disabled={isLoading}
                                        className={`rounded-full border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                            isActive
                                                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
                        <span>
                            {total} matching{" "}
                            {total === 1 ? "attempt" : "attempts"}
                        </span>

                        {totalPages > 1 ? (
                            <>
                                <span aria-hidden="true">•</span>
                                <span>
                                    Page {currentPage} of {totalPages}
                                </span>
                            </>
                        ) : null}
                    </div>
                </section>

                {errorMessage ? (
                    <div
                        role="alert"
                        className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
                    >
                        {errorMessage}
                    </div>
                ) : null}

                {successMessage ? (
                    <p className="sr-only" aria-live="polite">
                        {successMessage}
                    </p>
                ) : null}

                {isLoading ? (
                    <section
                        aria-label="Loading attempt history"
                        className="grid gap-4"
                    >
                        {[0, 1, 2].map((item) => (
                            <div
                                key={item}
                                className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                            >
                                <div className="h-5 w-32 rounded-full bg-slate-100" />
                                <div className="mt-4 h-6 w-2/3 rounded bg-slate-100" />

                                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <div className="h-16 rounded-2xl bg-slate-100" />
                                    <div className="h-16 rounded-2xl bg-slate-100" />
                                    <div className="h-16 rounded-2xl bg-slate-100" />
                                    <div className="h-16 rounded-2xl bg-slate-100" />
                                </div>
                            </div>
                        ))}
                    </section>
                ) : null}

                {!isLoading && attempts.length === 0 ? (
                    <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-lg font-black text-blue-600">
                            0
                        </div>

                        <h2 className="mt-4 text-xl font-black text-slate-950">
                            No attempts found
                        </h2>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                            {activeStatusFilter === "all"
                                ? "Your completed and active test attempts will appear here once you start practicing."
                                : "There are no attempts matching this status right now."}
                        </p>

                        <Link
                            href="/student/mock-tests"
                            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                        >
                            Browse Mock Tests & PYQs
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
                                Boolean(
                                    attempt.isResultVisible ||
                                        attempt.result?.isResultVisible
                                );

                            const canViewReview =
                                attempt.status === "submitted" &&
                                Boolean(
                                    attempt.review?.isDetailedReviewAvailable
                                );

                            const canResume =
                                attempt.status === "in_progress" &&
                                Boolean(attempt.attemptId);

                            const hasScore =
                                score.score != null ||
                                score.maxScore != null;

                            const hasAccuracy =
                                score.accuracy != null ||
                                score.percentage != null;

                            const hasQuestionSummary =
                                score.attemptedQuestions != null ||
                                score.totalQuestions != null;

                            return (
                                <article
                                    key={attempt.attemptId}
                                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
                                >
                                    <div className="p-5 sm:p-6">
                                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span
                                                        className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass}`}
                                                    >
                                                        {statusLabels[
                                                            attempt.status
                                                        ] || attempt.status}
                                                    </span>

                                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                                                        Attempt #
                                                        {attempt.attemptNumber ||
                                                            "-"}
                                                    </span>
                                                </div>

                                                <h2 className="mt-3 text-lg font-black leading-snug text-slate-950 sm:text-xl">
                                                    {attempt.title ||
                                                        "Untitled Mock Test"}
                                                </h2>

                                                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                                                    <span>
                                                        <span className="font-bold text-slate-600">
                                                            {attempt.status ===
                                                            "submitted"
                                                                ? "Completed"
                                                                : "Started"}
                                                        </span>{" "}
                                                        {formatDateTime(
                                                            attempt.status ===
                                                                "submitted"
                                                                ? attempt.submittedAt
                                                                : attempt.startedAt
                                                        )}
                                                    </span>

                                                    {attempt.status ===
                                                        "in_progress" &&
                                                    attempt.expiresAt ? (
                                                        <span>
                                                            <span className="font-bold text-slate-600">
                                                                Expires
                                                            </span>{" "}
                                                            {formatDateTime(
                                                                attempt.expiresAt
                                                            )}
                                                        </span>
                                                    ) : null}

                                                    {attempt.status ===
                                                        "expired" &&
                                                    attempt.expiresAt ? (
                                                        <span>
                                                            <span className="font-bold text-slate-600">
                                                                Expired
                                                            </span>{" "}
                                                            {formatDateTime(
                                                                attempt.expiresAt
                                                            )}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {attempt.status ===
                                                "submitted" ? (
                                                    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                                Time
                                                            </p>
                                                            <p className="mt-1 text-sm font-black text-slate-950">
                                                                {attempt.timeSpentSeconds !=
                                                                null
                                                                    ? formatSeconds(
                                                                          attempt.timeSpentSeconds
                                                                      )
                                                                    : "—"}
                                                            </p>
                                                        </div>

                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                                Score
                                                            </p>
                                                            <p className="mt-1 text-sm font-black text-slate-950">
                                                                {hasScore
                                                                    ? `${toDisplayNumber(
                                                                          score.score
                                                                      )}/${toDisplayNumber(
                                                                          score.maxScore
                                                                      )}`
                                                                    : "—"}
                                                            </p>
                                                        </div>

                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                                Accuracy
                                                            </p>
                                                            <p className="mt-1 text-sm font-black text-slate-950">
                                                                {hasAccuracy
                                                                    ? toDisplayNumber(
                                                                          score.accuracy ??
                                                                              score.percentage,
                                                                          "%"
                                                                      )
                                                                    : "—"}
                                                            </p>
                                                        </div>

                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                                Questions
                                                            </p>
                                                            <p className="mt-1 text-sm font-black text-slate-950">
                                                                {hasQuestionSummary
                                                                    ? `${toDisplayNumber(
                                                                          score.attemptedQuestions
                                                                      )}/${toDisplayNumber(
                                                                          score.totalQuestions
                                                                      )}`
                                                                    : "—"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                                Time Spent
                                                            </p>
                                                            <p className="mt-1 text-sm font-black text-slate-950">
                                                                {attempt.timeSpentSeconds !=
                                                                null
                                                                    ? formatSeconds(
                                                                          attempt.timeSpentSeconds
                                                                      )
                                                                    : "—"}
                                                            </p>
                                                        </div>

                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                                                {attempt.status ===
                                                                "expired"
                                                                    ? "Expired"
                                                                    : "Expires"}
                                                            </p>
                                                            <p className="mt-1 text-sm font-black text-slate-950">
                                                                {formatDateTime(
                                                                    attempt.expiresAt
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {canResume ||
                                            canViewResult ||
                                            canViewReview ? (
                                                <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:justify-end">
                                                    {canResume ? (
                                                        <Link
                                                            href={`/student/attempts/${attempt.attemptId}`}
                                                            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 sm:w-auto"
                                                        >
                                                            Resume
                                                        </Link>
                                                    ) : null}

                                                    {canViewResult ? (
                                                        <Link
                                                            href={`/student/attempts/${attempt.attemptId}/result`}
                                                            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100 sm:w-auto"
                                                        >
                                                            View Result
                                                        </Link>
                                                    ) : null}

                                                    {canViewReview ? (
                                                        <Link
                                                            href={`/student/attempts/${attempt.attemptId}/review`}
                                                            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 sm:w-auto"
                                                        >
                                                            Detailed Review
                                                        </Link>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                ) : null}

                {!isLoading && totalPages > 1 ? (
                    <nav
                        aria-label="Attempt history pagination"
                        className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="text-center sm:text-left">
                            <p className="text-sm font-black text-slate-800">
                                Page {currentPage} of {totalPages}
                            </p>
                            <p className="mt-1 text-xs font-medium text-slate-500">
                                {total} matching{" "}
                                {total === 1 ? "attempt" : "attempts"}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:flex">
                            <button
                                type="button"
                                onClick={() =>
                                    setCurrentPage((page) =>
                                        Math.max(page - 1, 1)
                                    )
                                }
                                disabled={currentPage <= 1 || isLoading}
                                className="min-h-11 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Previous
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setCurrentPage((page) =>
                                        Math.min(page + 1, totalPages)
                                    )
                                }
                                disabled={
                                    currentPage >= totalPages || isLoading
                                }
                                className="min-h-11 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </nav>
                ) : null}
            </div>
        </StudentPortalShell>
    );
}

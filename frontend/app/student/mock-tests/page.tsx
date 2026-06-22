"use client";

import { useState } from "react";

type PrimaryAction =
    | "start"
    | "resume"
    | "view_result"
    | "view_review"
    | "retake"
    | "limit_reached";

type MockTest = {
    _id: string;
    title: string;
    slug: string;
    description?: string;
    testType: string;
    accessType: string;
    examPattern: {
        name: string;
        examType: string;
        totalDurationMinutes: number;
    } | null;
    activeVersion: {
        versionNumber: number;
        publishedAt: string;
    } | null;
    studentAttemptSummary: {
        maxAttempts: number;
        attemptsUsed: number;
        attemptsRemaining: number;
        latestAttemptNumber: number | null;
        latestAttemptStatus: string | null;
        isAttemptLimitReached: boolean;
        primaryAction: PrimaryAction;
        result: {
            isResultVisible: boolean;
        };
        review: {
            isDetailedReviewAvailable: boolean;
        };
    };
};

type MockTestsResponse = {
    success: boolean;
    count: number;
    data: MockTest[];
    message?: string;
};

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const actionLabels: Record<PrimaryAction, string> = {
    start: "Start Test",
    resume: "Resume Test",
    view_result: "View Result",
    view_review: "View Review",
    retake: "Retake Test",
    limit_reached: "Attempt Limit Reached",
};

const getActionClassName = (action: PrimaryAction) => {
    if (action === "resume") {
        return "bg-amber-600";
    }

    if (action === "view_review") {
        return "bg-emerald-600";
    }

    if (action === "view_result") {
        return "bg-blue-600";
    }

    if (action === "retake") {
        return "bg-purple-600";
    }

    if (action === "limit_reached") {
        return "bg-slate-500";
    }

    return "bg-slate-900";
};

export default function StudentMockTestsPage() {
    const [token, setToken] = useState("");
    const [mockTests, setMockTests] = useState<MockTest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [actionMessage, setActionMessage] = useState("");

    const loadMockTests = async () => {
        const cleanToken = token.trim();

        if (!cleanToken) {
            setErrorMessage("Please paste a student token first.");
            return;
        }

        window.localStorage.setItem("pravixoStudentToken", cleanToken);

        setIsLoading(true);
        setErrorMessage("");
        setActionMessage("");

        try {
            const response = await fetch(`${API_BASE_URL}/api/student/mock-tests`, {
                headers: {
                    Authorization: `Bearer ${cleanToken}`,
                },
                cache: "no-store",
            });

            const result = (await response.json()) as MockTestsResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load mock tests.");
            }

            setMockTests(result.data || []);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Something went wrong while loading mock tests.";

            setErrorMessage(message);
            setMockTests([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleActionClick = (mockTest: MockTest) => {
        const action = mockTest.studentAttemptSummary.primaryAction;

        setActionMessage(
            `${actionLabels[action]} for "${mockTest.title}" will be connected in the next frontend step.`
        );
    };

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
            <div className="mx-auto max-w-5xl">
                <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                        PravixoEduTech Student Panel
                    </p>

                    <h1 className="mt-2 text-3xl font-bold">
                        Mock Tests
                    </h1>

                    <p className="mt-2 text-sm text-slate-600">
                        Student mock test listing page using backend dashboard
                        action summary.
                    </p>
                </section>

                <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <label
                        htmlFor="student-token"
                        className="text-sm font-semibold text-slate-800"
                    >
                        Student JWT token
                    </label>

                    <div className="mt-3 flex flex-col gap-3 md:flex-row">
                        <input
                            id="student-token"
                            type="password"
                            value={token}
                            onChange={(event) => setToken(event.target.value)}
                            placeholder="Paste student token from Thunder Client"
                            className="min-h-12 flex-1 rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500"
                        />

                        <button
                            type="button"
                            onClick={loadMockTests}
                            disabled={isLoading}
                            className="min-h-12 rounded-2xl bg-blue-700 px-6 text-sm font-semibold text-white disabled:bg-slate-400"
                        >
                            {isLoading ? "Loading..." : "Load Mock Tests"}
                        </button>
                    </div>

                    {errorMessage ? (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            {errorMessage}
                        </div>
                    ) : null}

                    {actionMessage ? (
                        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
                            {actionMessage}
                        </div>
                    ) : null}
                </section>

                <section>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold">
                            Available Tests
                        </h2>

                        <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold">
                            {mockTests.length} test(s)
                        </span>
                    </div>

                    {mockTests.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                            No mock tests loaded yet.
                        </div>
                    ) : (
                        <div className="grid gap-5">
                            {mockTests.map((mockTest) => {
                                const summary = mockTest.studentAttemptSummary;
                                const action = summary.primaryAction;

                                return (
                                    <article
                                        key={mockTest._id}
                                        className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                                    >
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                                {mockTest.testType}
                                            </span>

                                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                                {mockTest.accessType}
                                            </span>

                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                Version {mockTest.activeVersion?.versionNumber || "-"}
                                            </span>
                                        </div>

                                        <h3 className="text-xl font-bold">
                                            {mockTest.title}
                                        </h3>

                                        <p className="mt-2 text-sm text-slate-600">
                                            {mockTest.description || "No description available."}
                                        </p>

                                        <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-4">
                                            <div>
                                                <p className="text-xs font-semibold uppercase text-slate-500">
                                                    Pattern
                                                </p>
                                                <p className="mt-1 font-semibold">
                                                    {mockTest.examPattern?.name || "Not assigned"}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs font-semibold uppercase text-slate-500">
                                                    Duration
                                                </p>
                                                <p className="mt-1 font-semibold">
                                                    {mockTest.examPattern?.totalDurationMinutes || "-"} min
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs font-semibold uppercase text-slate-500">
                                                    Attempts
                                                </p>
                                                <p className="mt-1 font-semibold">
                                                    {summary.attemptsUsed}/{summary.maxAttempts}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs font-semibold uppercase text-slate-500">
                                                    Remaining
                                                </p>
                                                <p className="mt-1 font-semibold">
                                                    {summary.attemptsRemaining}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-xs font-semibold uppercase text-slate-500">
                                                    Current Action
                                                </p>

                                                <p className="mt-1 font-semibold">
                                                    {actionLabels[action]}
                                                </p>

                                                <p className="mt-1 text-xs text-slate-500">
                                                    Latest attempt:{" "}
                                                    {summary.latestAttemptNumber
                                                        ? `#${summary.latestAttemptNumber} - ${summary.latestAttemptStatus}`
                                                        : "No attempt yet"}
                                                </p>

                                                <p className="mt-1 text-xs text-slate-500">
                                                    Result:{" "}
                                                    {summary.result.isResultVisible
                                                        ? "Visible"
                                                        : "Hidden"}{" "}
                                                    | Review:{" "}
                                                    {summary.review.isDetailedReviewAvailable
                                                        ? "Available"
                                                        : "Not available"}{" "}
                                                    | Limit:{" "}
                                                    {summary.isAttemptLimitReached
                                                        ? "Reached"
                                                        : "Available"}
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleActionClick(mockTest)}
                                                disabled={action === "limit_reached"}
                                                className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white ${getActionClassName(
                                                    action
                                                )}`}
                                            >
                                                {actionLabels[action]}
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

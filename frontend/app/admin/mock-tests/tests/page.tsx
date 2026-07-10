"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const ADMIN_TOKEN_STORAGE_KEY = "pravixoAdminToken";
const ADMIN_PROFILE_STORAGE_KEY = "pravixoAdminProfile";

const ALLOWED_ADMIN_ROLES = ["super_admin", "tenant_admin", "content_admin"];

type AdminProfile = {
    id?: string;
    name?: string;
    tenantId?: string;
    role?: string;
};

type MeResponse = {
    success: boolean;
    message?: string;
    data?: AdminProfile;
};

type ExamPatternSummary = {
    _id: string;
    name?: string;
    slug?: string;
    examType?: string;
    totalDurationMinutes?: number;
};

type CategorySummary = {
    _id: string;
    name?: string;
    slug?: string;
};

type ActiveVersionSummary = {
    _id: string;
    versionNumber?: number;
    publishedAt?: string;
};

type MockTestSection = {
    sectionSlug?: string;
    name?: string;
    sectionType?: string;
    durationMinutes?: number;
    questionCount?: number;
    marksPerQuestion?: number;
    negativeMarks?: number;
    order?: number;
    questions?: {
        questionId?: string;
        order?: number;
    }[];
};

type MockTest = {
    _id: string;
    title?: string;
    slug?: string;
    description?: string;
    testType?: string;
    accessType?: string;
    price?: number;
    salePrice?: number;
    examPatternId?: ExamPatternSummary | string | null;
    categoryId?: CategorySummary | string | null;
    sections?: MockTestSection[];
    isPublished?: boolean;
    activeVersionId?: ActiveVersionSummary | string | null;
    isActive?: boolean;
    createdAt?: string;
};

type MockTestsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: MockTest[];
};

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role));
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const getExamPatternSummary = (
    examPatternId?: ExamPatternSummary | string | null
) => {
    if (!examPatternId || typeof examPatternId === "string") {
        return null;
    }

    return examPatternId;
};

const getCategorySummary = (categoryId?: CategorySummary | string | null) => {
    if (!categoryId || typeof categoryId === "string") {
        return null;
    }

    return categoryId;
};

const getActiveVersionSummary = (
    activeVersionId?: ActiveVersionSummary | string | null
) => {
    if (!activeVersionId || typeof activeVersionId === "string") {
        return null;
    }

    return activeVersionId;
};

const getAssignedQuestionCount = (mockTest: MockTest) => {
    return (mockTest.sections || []).reduce((total, section) => {
        return total + (section.questions?.length || 0);
    }, 0);
};

const getRequiredQuestionCount = (mockTest: MockTest) => {
    return (mockTest.sections || []).reduce((total, section) => {
        return total + Number(section.questionCount || 0);
    }, 0);
};

export default function AdminMockTestsPage() {
    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [message, setMessage] = useState("");
    const [mockTests, setMockTests] = useState<MockTest[]>([]);
    const [isMockTestsLoading, setIsMockTestsLoading] = useState(false);
    const [mockTestsError, setMockTestsError] = useState("");

    const loadMockTests = async (savedToken: string) => {
        setIsMockTestsLoading(true);
        setMockTestsError("");

        try {
            const response = await fetch(API_BASE_URL + "/api/mock-tests", {
                headers: {
                    Authorization: "Bearer " + savedToken,
                },
            });

            const result = (await response.json()) as MockTestsResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load mock tests.");
            }

            setMockTests(result.data || []);
        } catch (error) {
            setMockTestsError(
                error instanceof Error
                    ? error.message
                    : "Unable to load mock tests."
            );
        } finally {
            setIsMockTestsLoading(false);
        }
    };

    useEffect(() => {
        const verifyAdminSession = async () => {
            const savedToken =
                window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

            if (!savedToken) {
                clearAdminSessionStorage();
                setMessage("Please login with an admin account.");
                setIsAllowed(false);
                setIsReady(true);
                return;
            }

            try {
                const response = await fetch(API_BASE_URL + "/api/auth/me", {
                    headers: {
                        Authorization: "Bearer " + savedToken,
                    },
                });

                const result = (await response.json()) as MeResponse;

                if (!response.ok || !result.success || !result.data) {
                    throw new Error(result.message || "Admin session expired.");
                }

                if (!isAllowedAdminRole(result.data.role)) {
                    throw new Error("Please login with an admin account.");
                }

                window.localStorage.setItem(
                    ADMIN_PROFILE_STORAGE_KEY,
                    JSON.stringify(result.data)
                );

                setIsAllowed(true);
                setMessage("");
                void loadMockTests(savedToken);
            } catch (error) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage(
                    error instanceof Error
                        ? error.message
                        : "Admin session expired. Please login again."
                );
            } finally {
                setIsReady(true);
            }
        };

        void verifyAdminSession();
    }, []);

    if (!isReady) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
                <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold text-slate-600">
                        Loading admin session...
                    </p>
                </div>
            </main>
        );
    }

    if (!isAllowed) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
                <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold uppercase tracking-wide text-red-600">
                        Admin Access
                    </p>

                    <h1 className="mt-2 text-2xl font-bold">
                        Login required
                    </h1>

                    <p className="mt-3 text-sm text-slate-600">
                        {message || "Please login with an admin account."}
                    </p>

                    <Link
                        href="/admin/login"
                        className="mt-5 inline-flex rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                        Go to Admin Login
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                                Mock-Test Admin
                            </p>

                            <h1 className="mt-2 text-3xl font-bold">
                                Mock Test Builder
                            </h1>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Create draft mock tests by selecting an exam
                                pattern, matching sections, assigning active MCQ
                                questions, and publishing frozen versions.
                            </p>
                        </div>

                        <Link
                            href="/admin/dashboard"
                            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            Dashboard
                        </Link>
                    </div>
                </header>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                T-42O Step 2
                            </p>

                            <h2 className="mt-2 text-xl font-bold">
                                Mock Test List
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                Connected to{" "}
                                <span className="font-semibold">
                                    /api/mock-tests
                                </span>{" "}
                                for draft and published mock-test listing.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                const savedToken =
                                    window.localStorage.getItem(
                                        ADMIN_TOKEN_STORAGE_KEY
                                    ) || "";

                                if (savedToken) {
                                    void loadMockTests(savedToken);
                                }
                            }}
                            disabled={isMockTestsLoading}
                            className="w-fit rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                            {isMockTestsLoading ? "Refreshing..." : "Refresh List"}
                        </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Loaded Mock Tests
                            </p>
                            <p className="mt-2 text-2xl font-bold">
                                {mockTests.length}
                            </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                API
                            </p>
                            <p className="mt-2 break-all text-sm font-semibold text-slate-700">
                                /api/mock-tests
                            </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Scope
                            </p>
                            <p className="mt-2 text-sm font-semibold text-slate-700">
                                Draft and published tests
                            </p>
                        </div>
                    </div>

                    {mockTestsError ? (
                        <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                            {mockTestsError}
                        </div>
                    ) : null}

                    {isMockTestsLoading ? (
                        <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                            Loading mock tests...
                        </div>
                    ) : mockTests.length === 0 ? (
                        <div className="mt-5 rounded-2xl bg-blue-50 p-5 text-sm text-blue-900 ring-1 ring-blue-100">
                            No mock tests found yet. The create draft form will
                            be added in the next step.
                        </div>
                    ) : (
                        <div className="mt-5 grid gap-4">
                            {mockTests.map((mockTest) => {
                                const examPattern = getExamPatternSummary(
                                    mockTest.examPatternId
                                );
                                const category = getCategorySummary(
                                    mockTest.categoryId
                                );
                                const activeVersion = getActiveVersionSummary(
                                    mockTest.activeVersionId
                                );
                                const assignedQuestionCount =
                                    getAssignedQuestionCount(mockTest);
                                const requiredQuestionCount =
                                    getRequiredQuestionCount(mockTest);

                                return (
                                    <article
                                        key={mockTest._id}
                                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                                    >
                                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                                        {mockTest.testType ||
                                                            "mock"}
                                                    </span>

                                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                        {mockTest.accessType ||
                                                            "free"}
                                                    </span>

                                                    <span
                                                        className={
                                                            mockTest.isPublished
                                                                ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                                                : "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                                                        }
                                                    >
                                                        {mockTest.isPublished
                                                            ? "Published"
                                                            : "Draft"}
                                                    </span>

                                                    <span
                                                        className={
                                                            mockTest.isActive === false
                                                                ? "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                                                                : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                                        }
                                                    >
                                                        {mockTest.isActive === false
                                                            ? "Inactive"
                                                            : "Active"}
                                                    </span>
                                                </div>

                                                <h3 className="mt-3 text-lg font-bold text-slate-950">
                                                    {mockTest.title ||
                                                        "Untitled mock test"}
                                                </h3>

                                                <p className="mt-1 text-sm text-slate-500">
                                                    Slug: {mockTest.slug || "-"}
                                                </p>

                                                {mockTest.description ? (
                                                    <p className="mt-3 text-sm leading-6 text-slate-600">
                                                        {mockTest.description}
                                                    </p>
                                                ) : null}
                                            </div>

                                            <div className="min-w-[190px] rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Questions
                                                </p>
                                                <p className="mt-1 text-2xl font-bold">
                                                    {assignedQuestionCount}/
                                                    {requiredQuestionCount}
                                                </p>
                                                <p className="mt-2 text-xs text-slate-500">
                                                    Sections:{" "}
                                                    {mockTest.sections?.length || 0}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Exam Pattern:
                                                </span>{" "}
                                                {examPattern?.name || "-"}
                                            </p>

                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Duration:
                                                </span>{" "}
                                                {examPattern?.totalDurationMinutes ??
                                                    "-"}{" "}
                                                min
                                            </p>

                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Category:
                                                </span>{" "}
                                                {category?.name || "-"}
                                            </p>
                                        </div>

                                        <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Price:
                                                </span>{" "}
                                                ?{mockTest.price ?? 0}
                                            </p>

                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Sale Price:
                                                </span>{" "}
                                                ?{mockTest.salePrice ?? 0}
                                            </p>

                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Active Version:
                                                </span>{" "}
                                                {activeVersion?.versionNumber
                                                    ? "v" +
                                                      activeVersion.versionNumber
                                                    : "-"}
                                            </p>
                                        </div>

                                        {(mockTest.sections || []).length > 0 ? (
                                            <div className="mt-4 grid gap-3">
                                                {(mockTest.sections || []).map(
                                                    (section) => (
                                                        <div
                                                            key={
                                                                section.sectionSlug ||
                                                                section.name
                                                            }
                                                            className="rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200"
                                                        >
                                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                                <p className="font-semibold text-slate-900">
                                                                    {section.name ||
                                                                        section.sectionSlug ||
                                                                        "Section"}
                                                                </p>

                                                                <p className="text-slate-600">
                                                                    Questions:{" "}
                                                                    {section.questions
                                                                        ?.length ||
                                                                        0}
                                                                    /
                                                                    {section.questionCount ||
                                                                        0}
                                                                </p>
                                                            </div>

                                                            <p className="mt-2 text-xs text-slate-500">
                                                                {section.durationMinutes ||
                                                                    0}{" "}
                                                                min - +{" "}
                                                                {section.marksPerQuestion ??
                                                                    0}{" "}
                                                                / -{" "}
                                                                {section.negativeMarks ??
                                                                    0}
                                                            </p>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        ) : null}
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

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:5000";

const ADMIN_TOKEN_STORAGE_KEY = "pravixoAdminToken";
const ADMIN_PROFILE_STORAGE_KEY = "pravixoAdminProfile";

type AdminProfile = {
    role?: string;
};

type ActiveVersionSummary = {
    _id?: string;
    versionNumber?: number;
    publishedAt?: string;
};

type MockTestSummary = {
    _id: string;
    title?: string;
    slug?: string;
    testType?: string;
    isActive?: boolean;
    isPublished?: boolean;
    activeVersionId?: ActiveVersionSummary | string | null;
    publishedAt?: string;
};

type MockTestsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: MockTestSummary[];
};

type PublishedBySummary = {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
};

type ExamPatternSnapshot = {
    name?: string;
    examType?: string;
    totalDurationMinutes?: number;
    allowSectionSwitching?: boolean;
    allowQuestionNavigation?: boolean;
    allowLanguageSwitching?: boolean;
    showResultImmediately?: boolean;
};

type VersionSectionSnapshot = {
    sectionSlug?: string;
    name?: string;
    sectionType?: string;
    durationMinutes?: number;
    questionCount?: number;
    marksPerQuestion?: number;
    negativeMarks?: number;
    order?: number;
    questionGroups?: unknown[];
    questions?: unknown[];
};

type MockTestVersion = {
    _id: string;
    mockTestId?: string;
    versionNumber?: number;
    title?: string;
    slug?: string;
    description?: string;
    testType?: string;
    accessType?: string;
    price?: number;
    salePrice?: number;
    examPatternSnapshot?: ExamPatternSnapshot;
    sections?: VersionSectionSnapshot[];
    settings?: {
        maxAttempts?: number;
        showResultImmediately?: boolean;
        solutionVisibility?: string;
        allowResume?: boolean;
        interfaceMode?: string;
    };
    publishedBy?: PublishedBySummary | string | null;
    publishedAt?: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
};

type VersionsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    mockTest?: MockTestSummary;
    data?: MockTestVersion[];
};

type ToastState = {
    type: "success" | "error";
    message: string;
};

const clearAdminSessionStorage = () => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const formatDateTime = (value?: string) => {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString();
};

const getActiveVersionId = (mockTest?: MockTestSummary | null) => {
    if (!mockTest?.activeVersionId) {
        return "";
    }

    if (typeof mockTest.activeVersionId === "string") {
        return mockTest.activeVersionId;
    }

    return mockTest.activeVersionId._id || "";
};

const getActiveVersionNumber = (mockTest?: MockTestSummary | null) => {
    if (
        !mockTest?.activeVersionId ||
        typeof mockTest.activeVersionId === "string"
    ) {
        return null;
    }

    return mockTest.activeVersionId.versionNumber || null;
};

const getSectionQuestionCount = (sections?: VersionSectionSnapshot[]) => {
    return (sections || []).reduce((total, section) => {
        return total + (section.questions?.length || 0);
    }, 0);
};

const getRequiredQuestionCount = (sections?: VersionSectionSnapshot[]) => {
    return (sections || []).reduce((total, section) => {
        return total + Number(section.questionCount || 0);
    }, 0);
};

const getPublishedByLabel = (publishedBy?: PublishedBySummary | string | null) => {
    if (!publishedBy) {
        return "-";
    }

    if (typeof publishedBy === "string") {
        return publishedBy;
    }

    return publishedBy.name || publishedBy.email || publishedBy.role || "-";
};

const formatBooleanSetting = (value?: boolean) => {
    if (typeof value !== "boolean") {
        return "-";
    }

    return value ? "Yes" : "No";
};

const formatTextSetting = (value?: string) => {
    if (!value) {
        return "-";
    }

    return value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
};

const formatNumberSetting = (value?: number) => {
    if (typeof value !== "number") {
        return "-";
    }

    if (value <= 0) {
        return "Unlimited";
    }

    return String(value);
};

export default function AdminPublishedVersionsPage() {
    const [isChecking, setIsChecking] = useState(true);
    const [isAllowed, setIsAllowed] = useState(false);
    const [message, setMessage] = useState("Checking admin session...");
    const [token, setToken] = useState("");

    const [mockTests, setMockTests] = useState<MockTestSummary[]>([]);
    const [selectedMockTestId, setSelectedMockTestId] = useState("");
    const [versions, setVersions] = useState<MockTestVersion[]>([]);
    const [versionsMockTest, setVersionsMockTest] =
        useState<MockTestSummary | null>(null);

    const [isMockTestsLoading, setIsMockTestsLoading] = useState(false);
    const [isVersionsLoading, setIsVersionsLoading] = useState(false);
    const [mockTestsError, setMockTestsError] = useState("");
    const [versionsError, setVersionsError] = useState("");
    const [toast, setToast] = useState<ToastState | null>(null);

    const selectedMockTest = useMemo(() => {
        return (
            mockTests.find((mockTest) => mockTest._id === selectedMockTestId) ||
            versionsMockTest ||
            null
        );
    }, [mockTests, selectedMockTestId, versionsMockTest]);

    const activeVersionId = getActiveVersionId(selectedMockTest);
    const activeVersionNumber = getActiveVersionNumber(selectedMockTest);
    const latestVersionNumber =
        versions.length > 0 ? versions[0]?.versionNumber || null : null;

    const showToast = (nextToast: ToastState) => {
        setToast(nextToast);
        window.setTimeout(() => {
            setToast(null);
        }, 3500);
    };

    const handleAuthFailure = (nextMessage: string) => {
        clearAdminSessionStorage();
        setIsAllowed(false);
        setMessage(nextMessage);
        setToken("");
    };

    const loadVersions = async (savedToken: string, mockTestId: string) => {
        if (!mockTestId) {
            setVersions([]);
            setVersionsMockTest(null);
            return;
        }

        setIsVersionsLoading(true);
        setVersionsError("");

        try {
            const response = await fetch(
                API_BASE_URL + "/api/mock-tests/" + mockTestId + "/versions",
                {
                    headers: {
                        Authorization: "Bearer " + savedToken,
                    },
                }
            );

            const result = (await response.json()) as VersionsResponse;

            if (response.status === 401 || response.status === 403) {
                handleAuthFailure(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to load published versions."
                );
            }

            setVersions(result.data || []);
            setVersionsMockTest(result.mockTest || null);
        } catch (error) {
            const nextMessage =
                error instanceof Error
                    ? error.message
                    : "Unable to load published versions.";

            setVersionsError(nextMessage);
            setVersions([]);
            showToast({
                type: "error",
                message: nextMessage,
            });
        } finally {
            setIsVersionsLoading(false);
        }
    };

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
                handleAuthFailure(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load mock tests.");
            }

            const nextMockTests = result.data || [];
            setMockTests(nextMockTests);

            const requestedMockTestId =
                typeof window !== "undefined"
                    ? new URLSearchParams(window.location.search).get(
                          "mockTestId"
                      ) || ""
                    : "";

            const requestedMockTestExists = nextMockTests.some(
                (mockTest) => mockTest._id === requestedMockTestId
            );

            const currentSelectionStillExists = nextMockTests.some(
                (mockTest) => mockTest._id === selectedMockTestId
            );

            const nextSelectedMockTestId = requestedMockTestExists
                ? requestedMockTestId
                : currentSelectionStillExists
                  ? selectedMockTestId
                  : nextMockTests.find((mockTest) => mockTest.activeVersionId)
                        ?._id ||
                    nextMockTests[0]?._id ||
                    "";

            setSelectedMockTestId(nextSelectedMockTestId);

            if (nextSelectedMockTestId) {
                await loadVersions(savedToken, nextSelectedMockTestId);
            } else {
                setVersions([]);
                setVersionsMockTest(null);
            }
        } catch (error) {
            const nextMessage =
                error instanceof Error
                    ? error.message
                    : "Unable to load mock tests.";

            setMockTestsError(nextMessage);
            showToast({
                type: "error",
                message: nextMessage,
            });
        } finally {
            setIsMockTestsLoading(false);
        }
    };

    const handleMockTestChange = async (mockTestId: string) => {
        setSelectedMockTestId(mockTestId);

        if (!token) {
            return;
        }

        await loadVersions(token, mockTestId);
    };

    const handleRefresh = async () => {
        if (!token) {
            return;
        }

        await loadMockTests(token);
    };

    useEffect(() => {
        const verifyAdminSession = async () => {
            const savedToken = window.localStorage.getItem(
                ADMIN_TOKEN_STORAGE_KEY
            );
            const savedProfile = window.localStorage.getItem(
                ADMIN_PROFILE_STORAGE_KEY
            );

            if (!savedToken || !savedProfile) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage("Please login with an admin account.");
                setIsChecking(false);
                return;
            }

            try {
                const adminProfile = JSON.parse(savedProfile) as AdminProfile;

                if (
                    adminProfile.role !== "super_admin" &&
                    adminProfile.role !== "tenant_admin" &&
                    adminProfile.role !== "content_admin"
                ) {
                    clearAdminSessionStorage();
                    setIsAllowed(false);
                    setMessage(
                        "Access denied. This page is only for admin users."
                    );
                    setIsChecking(false);
                    return;
                }

                setIsAllowed(true);
                setMessage("Admin session verified.");
                setToken(savedToken);
                await loadMockTests(savedToken);
            } catch {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage("Invalid admin session. Please login again.");
            } finally {
                setIsChecking(false);
            }
        };

        void verifyAdminSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isChecking) {
        return (
            <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
                <section className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold text-slate-600">
                        {message}
                    </p>
                </section>
            </main>
        );
    }

    if (!isAllowed) {
        return (
            <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
                <section className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold text-red-600">
                        {message}
                    </p>

                    <Link
                        href="/admin/login"
                        className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                        Go to Admin Login
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
            <div className="mx-auto grid max-w-7xl gap-6">
                {toast ? (
                    <div
                        className={
                            "rounded-2xl p-4 text-sm font-semibold ring-1 " +
                            (toast.type === "success"
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                : "bg-red-50 text-red-700 ring-red-100")
                        }
                    >
                        {toast.message}
                    </div>
                ) : null}

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <p className="text-xs font-bold uppercase tracking-[0.35em] text-blue-700">
                        Mock-Test Admin
                    </p>

                    <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h1 className="text-3xl font-black">
                                Published Versions
                            </h1>

                            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                                View frozen published snapshots of mock tests.
                                Each version preserves the exam pattern,
                                sections, question snapshots, settings, and
                                publish metadata at the time of publishing.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/admin/dashboard"
                                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Dashboard
                            </Link>

                            <Link
                                href="/admin/mock-tests/tests"
                                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Mock Test Builder
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <label className="grid flex-1 gap-2 text-sm font-semibold text-slate-700">
                            Select Mock Test
                            <select
                                value={selectedMockTestId}
                                onChange={(event) =>
                                    void handleMockTestChange(
                                        event.target.value
                                    )
                                }
                                disabled={
                                    isMockTestsLoading || mockTests.length === 0
                                }
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                            >
                                {mockTests.length === 0 ? (
                                    <option value="">
                                        No mock tests available
                                    </option>
                                ) : null}

                                {mockTests.map((mockTest) => (
                                    <option
                                        key={mockTest._id}
                                        value={mockTest._id}
                                    >
                                        {mockTest.title ||
                                            mockTest.slug ||
                                            mockTest._id}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <button
                            type="button"
                            onClick={() => void handleRefresh()}
                            disabled={isMockTestsLoading || isVersionsLoading}
                            className="w-fit rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                            {isMockTestsLoading || isVersionsLoading
                                ? "Refreshing..."
                                : "Refresh"}
                        </button>
                    </div>

                    {mockTestsError ? (
                        <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                            {mockTestsError}
                        </div>
                    ) : null}
                </section>

                <section className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Loaded Mock Tests
                        </p>
                        <p className="mt-2 text-3xl font-black">
                            {mockTests.length}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Versions
                        </p>
                        <p className="mt-2 text-3xl font-black">
                            {versions.length}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Active Version
                        </p>
                        <p className="mt-2 text-3xl font-black">
                            {activeVersionNumber ? "v" + activeVersionNumber : "-"}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Latest Version
                        </p>
                        <p className="mt-2 text-3xl font-black">
                            {latestVersionNumber ? "v" + latestVersionNumber : "-"}
                        </p>
                    </div>
                </section>

                {selectedMockTest ? (
                    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Selected Mock Test
                                </p>

                                <h2 className="mt-2 text-xl font-bold">
                                    {selectedMockTest.title ||
                                        selectedMockTest.slug ||
                                        selectedMockTest._id}
                                </h2>

                                <p className="mt-2 text-sm text-slate-600">
                                    Slug: {selectedMockTest.slug || "-"}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <span
                                    className={
                                        "rounded-full px-3 py-1 text-xs font-bold " +
                                        (selectedMockTest.isPublished
                                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                            : "bg-amber-50 text-amber-700 ring-1 ring-amber-100")
                                    }
                                >
                                    {selectedMockTest.isPublished
                                        ? "Published"
                                        : "Draft"}
                                </span>

                                <span
                                    className={
                                        "rounded-full px-3 py-1 text-xs font-bold " +
                                        (selectedMockTest.isActive === false
                                            ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                                            : "bg-blue-50 text-blue-700 ring-1 ring-blue-100")
                                    }
                                >
                                    {selectedMockTest.isActive === false
                                        ? "Inactive"
                                        : "Active"}
                                </span>
                            </div>
                        </div>
                    </section>
                ) : null}

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Version History
                            </p>

                            <h2 className="mt-2 text-xl font-bold">
                                Frozen Published Snapshots
                            </h2>
                        </div>

                        <p className="text-sm font-semibold text-slate-500">
                            API: /api/mock-tests/:id/versions
                        </p>
                    </div>

                    {versionsError ? (
                        <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                            {versionsError}
                        </div>
                    ) : null}

                    {isVersionsLoading ? (
                        <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                            Loading published versions...
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="mt-5 rounded-2xl bg-amber-50 p-5 text-sm text-amber-800 ring-1 ring-amber-100">
                            <p className="font-semibold">
                                No published versions found for this mock test yet.
                            </p>
                            <p className="mt-2">
                                Publish this mock test from Mock Test Builder to
                                create the first frozen read-only snapshot.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-5 grid gap-4">
                            {versions.map((version) => {
                                const isActiveVersion =
                                    activeVersionId &&
                                    activeVersionId === version._id;
                                const isLatestVersion =
                                    latestVersionNumber ===
                                    version.versionNumber;
                                const sectionCount =
                                    version.sections?.length || 0;
                                const assignedQuestionCount =
                                    getSectionQuestionCount(version.sections);
                                const requiredQuestionCount =
                                    getRequiredQuestionCount(version.sections);
                                const examPattern =
                                    version.examPatternSnapshot || {};

                                return (
                                    <article
                                        key={version._id}
                                        className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200"
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">
                                                        v{version.versionNumber}
                                                    </span>

                                                    <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-purple-100">
                                                        Read-only Snapshot
                                                    </span>

                                                    {isActiveVersion ? (
                                                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                                                            Active Version
                                                        </span>
                                                    ) : null}

                                                    {isLatestVersion ? (
                                                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                                                            Latest
                                                        </span>
                                                    ) : null}

                                                    {version.isActive === false ? (
                                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                                                            Version Inactive
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <h3 className="mt-3 text-lg font-bold">
                                                    {version.title ||
                                                        version.slug ||
                                                        "Untitled version"}
                                                </h3>

                                                <p className="mt-2 text-sm text-slate-600">
                                                    Published:{" "}
                                                    {formatDateTime(
                                                        version.publishedAt
                                                    )}
                                                </p>

                                                <p className="mt-1 text-sm text-slate-600">
                                                    Published by:{" "}
                                                    {getPublishedByLabel(
                                                        version.publishedBy
                                                    )}
                                                </p>
                                            </div>

                                            <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:min-w-[360px]">
                                                <p>
                                                    <span className="font-semibold text-slate-800">
                                                        Type:
                                                    </span>{" "}
                                                    {version.testType || "-"}
                                                </p>

                                                <p>
                                                    <span className="font-semibold text-slate-800">
                                                        Access:
                                                    </span>{" "}
                                                    {version.accessType || "-"}
                                                </p>

                                                <p>
                                                    <span className="font-semibold text-slate-800">
                                                        Price:
                                                    </span>{" "}
                                                    Rs. {version.price ?? 0}
                                                </p>

                                                <p>
                                                    <span className="font-semibold text-slate-800">
                                                        Sale:
                                                    </span>{" "}
                                                    Rs. {version.salePrice ?? 0}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Exam Pattern
                                                </p>
                                                <p className="mt-2 text-sm font-bold">
                                                    {examPattern.name || "-"}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {examPattern.examType ||
                                                        "custom"}
                                                </p>
                                            </div>

                                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Duration
                                                </p>
                                                <p className="mt-2 text-sm font-bold">
                                                    {examPattern.totalDurationMinutes ??
                                                        0}{" "}
                                                    min
                                                </p>
                                            </div>

                                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Sections
                                                </p>
                                                <p className="mt-2 text-sm font-bold">
                                                    {sectionCount}
                                                </p>
                                            </div>

                                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Questions
                                                </p>
                                                <p className="mt-2 text-sm font-bold">
                                                    {assignedQuestionCount}/
                                                    {requiredQuestionCount}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Version Settings Snapshot
                                                </p>

                                                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                                                    <p>
                                                        <span className="font-semibold text-slate-800">
                                                            Max Attempts:
                                                        </span>{" "}
                                                        {formatNumberSetting(
                                                            version.settings
                                                                ?.maxAttempts
                                                        )}
                                                    </p>

                                                    <p>
                                                        <span className="font-semibold text-slate-800">
                                                            Resume:
                                                        </span>{" "}
                                                        {formatBooleanSetting(
                                                            version.settings
                                                                ?.allowResume
                                                        )}
                                                    </p>

                                                    <p>
                                                        <span className="font-semibold text-slate-800">
                                                            Result Immediate:
                                                        </span>{" "}
                                                        {formatBooleanSetting(
                                                            version.settings
                                                                ?.showResultImmediately
                                                        )}
                                                    </p>

                                                    <p>
                                                        <span className="font-semibold text-slate-800">
                                                            Solutions:
                                                        </span>{" "}
                                                        {formatTextSetting(
                                                            version.settings
                                                                ?.solutionVisibility
                                                        )}
                                                    </p>

                                                    <p>
                                                        <span className="font-semibold text-slate-800">
                                                            Interface:
                                                        </span>{" "}
                                                        {formatTextSetting(
                                                            version.settings
                                                                ?.interfaceMode
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Exam Behavior Snapshot
                                                </p>

                                                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                                                    <p>
                                                        <span className="font-semibold text-slate-800">
                                                            Section Switching:
                                                        </span>{" "}
                                                        {formatBooleanSetting(
                                                            examPattern.allowSectionSwitching
                                                        )}
                                                    </p>

                                                    <p>
                                                        <span className="font-semibold text-slate-800">
                                                            Question Navigation:
                                                        </span>{" "}
                                                        {formatBooleanSetting(
                                                            examPattern.allowQuestionNavigation
                                                        )}
                                                    </p>

                                                    <p>
                                                        <span className="font-semibold text-slate-800">
                                                            Language Switching:
                                                        </span>{" "}
                                                        {formatBooleanSetting(
                                                            examPattern.allowLanguageSwitching
                                                        )}
                                                    </p>

                                                    <p>
                                                        <span className="font-semibold text-slate-800">
                                                            Pattern Result:
                                                        </span>{" "}
                                                        {formatBooleanSetting(
                                                            examPattern.showResultImmediately
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
                                            This is a frozen read-only snapshot.
                                            Editing the draft mock test will not
                                            change this published version.
                                        </div>

                                        {(version.sections || []).length > 0 ? (
                                            <div className="mt-4 grid gap-3">
                                                {(version.sections || []).map(
                                                    (section) => (
                                                        <div
                                                            key={
                                                                section.sectionSlug ||
                                                                section.name
                                                            }
                                                            className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200"
                                                        >
                                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                                <p className="font-semibold text-slate-900">
                                                                    {section.name ||
                                                                        section.sectionSlug ||
                                                                        "Section"}
                                                                </p>

                                                                <p className="text-xs font-semibold text-slate-500">
                                                                    Questions:{" "}
                                                                    {section
                                                                        .questions
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
                                                                min | +{" "}
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

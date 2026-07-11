"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

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

type ExamPatternSection = {
    name?: string;
    sectionType?: string;
    durationMinutes?: number;
    questionCount?: number;
    marksPerQuestion?: number;
    negativeMarks?: number;
    order?: number;
};

type ExamPattern = {
    _id: string;
    name?: string;
    slug?: string;
    description?: string;
    examType?: string;
    totalDurationMinutes?: number;
    sections?: ExamPatternSection[];
    isActive?: boolean;
};

type ExamPatternsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: ExamPattern[];
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
    instructionsEn?: string;
    instructionsHi?: string;
    sections?: MockTestSection[];
    settings?: {
        maxAttempts?: number;
        solutionVisibility?: string;
        interfaceMode?: string;
    };
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

type MockTestMutationResponse = {
    success: boolean;
    message?: string;
    data?: MockTest;
};

type CreateMockTestForm = {
    title: string;
    slug: string;
    description: string;
    testType: "mock" | "pyq" | "practice";
    accessType: "free" | "paid" | "assigned";
    price: string;
    salePrice: string;
    examPatternId: string;
    instructionsEn: string;
    instructionsHi: string;
    maxAttempts: string;
    solutionVisibility: "after_submit" | "after_test_end" | "never";
    interfaceMode: "default" | "ssc" | "banking" | "railway" | "cpct";
};

type ToastState = {
    type: "success" | "error";
    message: string;
};

const initialCreateMockTestForm: CreateMockTestForm = {
    title: "",
    slug: "",
    description: "",
    testType: "mock",
    accessType: "free",
    price: "0",
    salePrice: "0",
    examPatternId: "",
    instructionsEn: "",
    instructionsHi: "",
    maxAttempts: "1",
    solutionVisibility: "after_submit",
    interfaceMode: "default",
};

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role));
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const hasText = (value: string) => {
    return value.trim().length > 0;
};

const createSlugFromText = (value: string) => {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
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
    const [examPatterns, setExamPatterns] = useState<ExamPattern[]>([]);
    const [isMockTestsLoading, setIsMockTestsLoading] = useState(false);
    const [isExamPatternsLoading, setIsExamPatternsLoading] = useState(false);
    const [mockTestsError, setMockTestsError] = useState("");
    const [examPatternsError, setExamPatternsError] = useState("");
    const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
    const [isCreateSaving, setIsCreateSaving] = useState(false);
    const [editingMockTestId, setEditingMockTestId] = useState("");
    const [createMockTestForm, setCreateMockTestForm] =
        useState<CreateMockTestForm>(initialCreateMockTestForm);
    const [toast, setToast] = useState<ToastState | null>(null);

    const selectedExamPattern =
        examPatterns.find(
            (pattern) => pattern._id === createMockTestForm.examPatternId
        ) || null;

    const editingMockTest =
        mockTests.find((mockTest) => mockTest._id === editingMockTestId) ||
        null;

    const editingExamPattern = getExamPatternSummary(
        editingMockTest?.examPatternId
    );

    const showToast = (nextToast: ToastState) => {
        setToast(nextToast);

        window.setTimeout(() => {
            setToast(null);
        }, 3000);
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

    const loadExamPatterns = async (savedToken: string) => {
        setIsExamPatternsLoading(true);
        setExamPatternsError("");

        try {
            const response = await fetch(API_BASE_URL + "/api/exam-patterns", {
                headers: {
                    Authorization: "Bearer " + savedToken,
                },
            });

            const result = (await response.json()) as ExamPatternsResponse;

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
                throw new Error(
                    result.message || "Unable to load exam patterns."
                );
            }

            setExamPatterns((result.data || []).filter((item) => item.isActive !== false));
        } catch (error) {
            setExamPatternsError(
                error instanceof Error
                    ? error.message
                    : "Unable to load exam patterns."
            );
        } finally {
            setIsExamPatternsLoading(false);
        }
    };

    const updateCreateMockTestForm = (
        field: keyof CreateMockTestForm,
        value: string
    ) => {
        setCreateMockTestForm((current) => {
            if (field === "title" && !hasText(current.slug)) {
                return {
                    ...current,
                    title: value,
                    slug: createSlugFromText(value),
                };
            }

            if (field === "examPatternId") {
                const selectedPattern = examPatterns.find(
                    (pattern) => pattern._id === value
                );

                if (selectedPattern && !hasText(current.title)) {
                    return {
                        ...current,
                        examPatternId: value,
                        title: selectedPattern.name || "",
                        slug: createSlugFromText(selectedPattern.name || ""),
                    };
                }
            }

            return {
                ...current,
                [field]: value,
            };
        });
    };

    const resetCreateMockTestForm = () => {
        setCreateMockTestForm(initialCreateMockTestForm);
    };

    const startEditMockTest = (mockTest: MockTest) => {
        const examPattern = getExamPatternSummary(mockTest.examPatternId);

        setEditingMockTestId(mockTest._id);
        setCreateMockTestForm({
            title: mockTest.title || "",
            slug: mockTest.slug || "",
            description: mockTest.description || "",
            testType:
                mockTest.testType === "pyq" ||
                mockTest.testType === "practice"
                    ? mockTest.testType
                    : "mock",
            accessType:
                mockTest.accessType === "paid" ||
                mockTest.accessType === "assigned"
                    ? mockTest.accessType
                    : "free",
            price: String(mockTest.price ?? 0),
            salePrice: String(mockTest.salePrice ?? 0),
            examPatternId: examPattern?._id || "",
            instructionsEn: mockTest.instructionsEn || "",
            instructionsHi: mockTest.instructionsHi || "",
            maxAttempts: String(mockTest.settings?.maxAttempts ?? 1),
            solutionVisibility:
                mockTest.settings?.solutionVisibility === "after_test_end" ||
                mockTest.settings?.solutionVisibility === "never"
                    ? mockTest.settings.solutionVisibility
                    : "after_submit",
            interfaceMode:
                mockTest.settings?.interfaceMode === "ssc" ||
                mockTest.settings?.interfaceMode === "banking" ||
                mockTest.settings?.interfaceMode === "railway" ||
                mockTest.settings?.interfaceMode === "cpct"
                    ? mockTest.settings.interfaceMode
                    : "default",
        });
        setIsCreateFormOpen(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const cancelEditMockTest = () => {
        setEditingMockTestId("");
        resetCreateMockTestForm();
        setIsCreateFormOpen(false);
    };

    const buildSectionsFromSelectedPattern = () => {
        if (!selectedExamPattern) {
            return [];
        }

        return (selectedExamPattern.sections || []).map((section, index) => ({
            sectionSlug: createSlugFromText(
                section.name || "section-" + String(index + 1)
            ),
            name: section.name || "Section " + String(index + 1),
            sectionType: section.sectionType || "mcq",
            durationMinutes: Number(section.durationMinutes || 0),
            questionCount: Number(section.questionCount || 0),
            marksPerQuestion: Number(section.marksPerQuestion || 0),
            negativeMarks: Number(section.negativeMarks || 0),
            order: Number(section.order || index + 1),
            questions: [],
        }));
    };

    const validateCreateMockTestForm = () => {
        if (!hasText(createMockTestForm.title)) {
            return "Mock test title is required.";
        }

        if (!hasText(createMockTestForm.slug)) {
            return "Mock test slug is required.";
        }

        if (!editingMockTestId) {
            if (!createMockTestForm.examPatternId || !selectedExamPattern) {
                return "Please select an active exam pattern.";
            }

            if (
                !Array.isArray(selectedExamPattern.sections) ||
                selectedExamPattern.sections.length === 0
            ) {
                return "Selected exam pattern has no sections.";
            }
        }

        const price = Number(createMockTestForm.price);
        const salePrice = Number(createMockTestForm.salePrice);
        const maxAttempts = Number(createMockTestForm.maxAttempts);

        if (!Number.isFinite(price) || price < 0) {
            return "Price must be zero or more.";
        }

        if (!Number.isFinite(salePrice) || salePrice < 0) {
            return "Sale price must be zero or more.";
        }

        if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
            return "Max attempts must be a positive integer.";
        }

        return "";
    };

    const buildCreateMockTestPayload = () => {
        const price = Number(createMockTestForm.price);
        const salePrice = Number(createMockTestForm.salePrice);
        const maxAttempts = Number(createMockTestForm.maxAttempts);

        return {
            title: createMockTestForm.title.trim(),
            slug: createSlugFromText(createMockTestForm.slug),
            description: createMockTestForm.description.trim(),
            testType: createMockTestForm.testType,
            examPatternId: createMockTestForm.examPatternId,
            accessType: createMockTestForm.accessType,
            price,
            salePrice,
            isPurchasable: createMockTestForm.accessType === "paid",
            instructionsEn: createMockTestForm.instructionsEn.trim(),
            instructionsHi: createMockTestForm.instructionsHi.trim(),
            sections: buildSectionsFromSelectedPattern(),
            settings: {
                maxAttempts,
                showResultImmediately: true,
                solutionVisibility: createMockTestForm.solutionVisibility,
                allowResume: true,
                allowQuestionNavigation: true,
                allowSectionSwitching: true,
                allowLanguageSwitching: true,
                shuffleQuestions: false,
                shuffleOptions: false,
                rankEnabled: false,
                batchRankEnabled: false,
                platformRankEnabled: false,
                questionFeedbackEnabled: true,
                showTopicWiseAnalysis: true,
                showDifficultyAnalysis: true,
                showTimeAnalysis: true,
                interfaceMode: createMockTestForm.interfaceMode,
            },
        };
    };

    const buildUpdateMockTestPayload = () => {
        const price = Number(createMockTestForm.price);
        const salePrice = Number(createMockTestForm.salePrice);
        const maxAttempts = Number(createMockTestForm.maxAttempts);

        return {
            title: createMockTestForm.title.trim(),
            slug: createSlugFromText(createMockTestForm.slug),
            description: createMockTestForm.description.trim(),
            testType: createMockTestForm.testType,
            accessType: createMockTestForm.accessType,
            price,
            salePrice,
            isPurchasable: createMockTestForm.accessType === "paid",
            instructionsEn: createMockTestForm.instructionsEn.trim(),
            instructionsHi: createMockTestForm.instructionsHi.trim(),
            settings: {
                maxAttempts,
                solutionVisibility: createMockTestForm.solutionVisibility,
                interfaceMode: createMockTestForm.interfaceMode,
            },
        };
    };

    const handleCreateMockTest = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const validationError = validateCreateMockTestForm();

        if (validationError) {
            showToast({
                type: "error",
                message: validationError,
            });
            return;
        }

        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        if (!savedToken) {
            clearAdminSessionStorage();
            setIsAllowed(false);
            setMessage("Please login with an admin account.");
            return;
        }

        setIsCreateSaving(true);

        try {
            const response = await fetch(API_BASE_URL + "/api/mock-tests", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + savedToken,
                },
                body: JSON.stringify(buildCreateMockTestPayload()),
            });

            const result = (await response.json()) as MockTestMutationResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success || !result.data?._id) {
                throw new Error(
                    result.message || "Unable to create mock test."
                );
            }

            await loadMockTests(savedToken);

            resetCreateMockTestForm();
            setIsCreateFormOpen(false);
            showToast({
                type: "success",
                message: "Mock test draft created successfully.",
            });
        } catch (error) {
            showToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to create mock test.",
            });
        } finally {
            setIsCreateSaving(false);
        }
    };

    const handleUpdateMockTest = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!editingMockTestId) {
            return;
        }

        const validationError = validateCreateMockTestForm();

        if (validationError) {
            showToast({
                type: "error",
                message: validationError,
            });
            return;
        }

        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        if (!savedToken) {
            clearAdminSessionStorage();
            setIsAllowed(false);
            setMessage("Please login with an admin account.");
            return;
        }

        setIsCreateSaving(true);

        try {
            const response = await fetch(
                API_BASE_URL + "/api/mock-tests/" + editingMockTestId,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + savedToken,
                    },
                    body: JSON.stringify(buildUpdateMockTestPayload()),
                }
            );

            const result = (await response.json()) as MockTestMutationResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success || !result.data?._id) {
                throw new Error(
                    result.message || "Unable to update mock test."
                );
            }

            const updatedMockTest = result.data;

            setMockTests((current) =>
                current.map((mockTest) =>
                    mockTest._id === updatedMockTest._id
                        ? updatedMockTest
                        : mockTest
                )
            );

            setEditingMockTestId("");
            resetCreateMockTestForm();
            setIsCreateFormOpen(false);
            showToast({
                type: "success",
                message: "Mock test updated successfully.",
            });
        } catch (error) {
            showToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to update mock test.",
            });
        } finally {
            setIsCreateSaving(false);
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
                void loadExamPatterns(savedToken);
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
            {toast ? (
                <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl bg-white p-4 text-sm font-semibold shadow-lg ring-1 ring-slate-200">
                    <p
                        className={
                            toast.type === "success"
                                ? "text-emerald-700"
                                : "text-red-700"
                        }
                    >
                        {toast.message}
                    </p>
                </div>
            ) : null}

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
                                {editingMockTestId
                                    ? "T-42O Step 4"
                                    : "T-42O Step 3"}
                            </p>

                            <h2 className="mt-2 text-xl font-bold">
                                {editingMockTestId
                                    ? "Edit Mock Test Metadata"
                                    : "Create Draft Mock Test"}
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {editingMockTestId
                                    ? "Update mock test metadata safely. Exam pattern and sections are not changed in this step."
                                    : "Create a draft from an active exam pattern. The section structure is copied from the selected pattern with empty question lists."}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                if (editingMockTestId) {
                                    cancelEditMockTest();
                                    return;
                                }

                                setIsCreateFormOpen((value) => !value);
                            }}
                            className="w-fit rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                            {editingMockTestId
                                ? "Cancel Edit"
                                : isCreateFormOpen
                                  ? "Close Form"
                                  : "Create Draft"}
                        </button>
                    </div>

                    {isCreateFormOpen ? (
                        <form
                            onSubmit={
                                editingMockTestId
                                    ? handleUpdateMockTest
                                    : handleCreateMockTest
                            }
                            className="mt-5 grid gap-5 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200"
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Exam Pattern
                                    <select
                                        value={createMockTestForm.examPatternId}
                                        onChange={(event) =>
                                            updateCreateMockTestForm(
                                                "examPatternId",
                                                event.target.value
                                            )
                                        }
                                        disabled={Boolean(editingMockTestId)}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                                    >
                                        <option value="">
                                            Select active exam pattern
                                        </option>

                                        {editingMockTestId &&
                                        editingExamPattern &&
                                        !examPatterns.some(
                                            (pattern) =>
                                                pattern._id ===
                                                editingExamPattern._id
                                        ) ? (
                                            <option value={editingExamPattern._id}>
                                                {editingExamPattern.name ||
                                                    editingExamPattern.slug}
                                            </option>
                                        ) : null}

                                        {examPatterns.map((pattern) => (
                                            <option key={pattern._id} value={pattern._id}>
                                                {pattern.name || pattern.slug}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-xs font-normal text-slate-500">
                                        {editingMockTestId
                                            ? "Exam pattern cannot be changed in metadata edit mode."
                                            : isExamPatternsLoading
                                              ? "Loading active exam patterns..."
                                              : examPatterns.length +
                                                " active patterns available"}
                                    </span>
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Test Type
                                    <select
                                        value={createMockTestForm.testType}
                                        onChange={(event) =>
                                            updateCreateMockTestForm(
                                                "testType",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    >
                                        <option value="mock">Mock</option>
                                        <option value="practice">Practice</option>
                                        <option value="pyq">PYQ</option>
                                    </select>
                                </label>
                            </div>

                            {examPatternsError ? (
                                <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                                    {examPatternsError}
                                </div>
                            ) : null}

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Title
                                    <input
                                        value={createMockTestForm.title}
                                        onChange={(event) =>
                                            updateCreateMockTestForm(
                                                "title",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="SSC CGL Full Mock Test 01"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Slug
                                    <input
                                        value={createMockTestForm.slug}
                                        onChange={(event) =>
                                            updateCreateMockTestForm(
                                                "slug",
                                                createSlugFromText(event.target.value)
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="ssc-cgl-full-mock-test-01"
                                    />
                                </label>
                            </div>

                            <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                Description
                                <textarea
                                    value={createMockTestForm.description}
                                    onChange={(event) =>
                                        updateCreateMockTestForm(
                                            "description",
                                            event.target.value
                                        )
                                    }
                                    rows={3}
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    placeholder="Short admin/public description"
                                />
                            </label>

                            <div className="grid gap-4 md:grid-cols-5">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Access
                                    <select
                                        value={createMockTestForm.accessType}
                                        onChange={(event) =>
                                            updateCreateMockTestForm(
                                                "accessType",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    >
                                        <option value="free">Free</option>
                                        <option value="paid">Paid</option>
                                        <option value="assigned">Assigned</option>
                                    </select>
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Price
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={createMockTestForm.price}
                                        onChange={(event) =>
                                            updateCreateMockTestForm(
                                                "price",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Sale Price
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={createMockTestForm.salePrice}
                                        onChange={(event) =>
                                            updateCreateMockTestForm(
                                                "salePrice",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Max Attempts
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={createMockTestForm.maxAttempts}
                                        onChange={(event) =>
                                            updateCreateMockTestForm(
                                                "maxAttempts",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Interface
                                    <select
                                        value={createMockTestForm.interfaceMode}
                                        onChange={(event) =>
                                            updateCreateMockTestForm(
                                                "interfaceMode",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    >
                                        <option value="default">Default</option>
                                        <option value="ssc">SSC</option>
                                        <option value="banking">Banking</option>
                                        <option value="railway">Railway</option>
                                        <option value="cpct">CPCT</option>
                                    </select>
                                </label>
                            </div>

                            <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                Solution Visibility
                                <select
                                    value={createMockTestForm.solutionVisibility}
                                    onChange={(event) =>
                                        updateCreateMockTestForm(
                                            "solutionVisibility",
                                            event.target.value
                                        )
                                    }
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                >
                                    <option value="after_submit">
                                        After submit
                                    </option>
                                    <option value="after_test_end">
                                        After test end
                                    </option>
                                    <option value="never">Never</option>
                                </select>
                            </label>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Instructions English
                                    <textarea
                                        value={createMockTestForm.instructionsEn}
                                        onChange={(event) =>
                                            updateCreateMockTestForm(
                                                "instructionsEn",
                                                event.target.value
                                            )
                                        }
                                        rows={3}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Optional test instructions"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Instructions Hindi
                                    <textarea
                                        value={createMockTestForm.instructionsHi}
                                        onChange={(event) =>
                                            updateCreateMockTestForm(
                                                "instructionsHi",
                                                event.target.value
                                            )
                                        }
                                        rows={3}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Optional Hindi instructions"
                                    />
                                </label>
                            </div>

                            {!editingMockTestId && selectedExamPattern ? (
                                <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-950 ring-1 ring-blue-100">
                                    <p className="font-bold">
                                        Section preview copied from pattern
                                    </p>

                                    <p className="mt-1 text-blue-800">
                                        {selectedExamPattern.name} -{" "}
                                        {selectedExamPattern.totalDurationMinutes ||
                                            0}{" "}
                                        min -{" "}
                                        {selectedExamPattern.sections?.length || 0}{" "}
                                        sections
                                    </p>

                                    <div className="mt-4 grid gap-3">
                                        {(selectedExamPattern.sections || []).map(
                                            (section, index) => (
                                                <div
                                                    key={
                                                        section.name ||
                                                        String(index)
                                                    }
                                                    className="rounded-2xl bg-white p-4 ring-1 ring-blue-100"
                                                >
                                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                        <p className="font-semibold text-slate-950">
                                                            {section.name ||
                                                                "Section " +
                                                                    String(
                                                                        index + 1
                                                                    )}
                                                        </p>

                                                        <p className="text-slate-600">
                                                            Questions:{" "}
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
                                </div>
                            ) : null}

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="submit"
                                    disabled={isCreateSaving}
                                    className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                    {isCreateSaving
                                        ? editingMockTestId
                                            ? "Saving..."
                                            : "Creating..."
                                        : editingMockTestId
                                          ? "Save Changes"
                                          : "Create Draft"}
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        editingMockTestId
                                            ? cancelEditMockTest
                                            : resetCreateMockTestForm
                                    }
                                    disabled={isCreateSaving}
                                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                    {editingMockTestId ? "Cancel Edit" : "Reset"}
                                </button>
                            </div>
                        </form>
                    ) : null}
                </section>

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
                                    void loadExamPatterns(savedToken);
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
                            No mock tests found yet. Use Create Draft to create
                            your first draft mock test.
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

                                            <div className="grid min-w-[190px] gap-3">
                                                <div className="rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Questions
                                                    </p>
                                                    <p className="mt-1 text-2xl font-bold">
                                                        {assignedQuestionCount}/
                                                        {requiredQuestionCount}
                                                    </p>
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        Sections:{" "}
                                                        {mockTest.sections?.length ||
                                                            0}
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        startEditMockTest(mockTest)
                                                    }
                                                    className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                                >
                                                    Edit
                                                </button>
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
                                                Rs. {mockTest.price ?? 0}
                                            </p>

                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Sale Price:
                                                </span>{" "}
                                                Rs. {mockTest.salePrice ?? 0}
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

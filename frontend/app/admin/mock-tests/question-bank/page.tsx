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
const OPTION_IDS = ["A", "B", "C", "D"] as const;

type OptionId = (typeof OPTION_IDS)[number];

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

type QuestionGroupSummary = {
    _id: string;
    title?: string;
    slug?: string;
    groupType?: string;
    displayMode?: string;
    isActive?: boolean;
};

type QuestionGroupsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: QuestionGroupSummary[];
};

type CategorySummary = {
    _id: string;
    name?: string;
    slug?: string;
};

type QuestionOption = {
    optionId: string;
    textEn?: string;
    textHi?: string;
    imageUrl?: string;
};

type Question = {
    _id: string;
    categoryId?: CategorySummary | string | null;
    questionGroupId?: QuestionGroupSummary | string | null;
    groupQuestionOrder?: number | null;
    subject?: string;
    topic?: string;
    subTopic?: string;
    questionType?: string;
    sourceType?: string;
    questionTextEn?: string;
    questionTextHi?: string;
    questionImageUrl?: string;
    options?: QuestionOption[];
    correctOptionId?: string;
    explanationEn?: string;
    explanationHi?: string;
    marks?: number;
    negativeMarks?: number;
    difficulty?: string;
    tags?: string[];
    isActive?: boolean;
    createdAt?: string;
};

type QuestionsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: Question[];
};

type QuestionMutationResponse = {
    success: boolean;
    message?: string;
    data?: Question;
};

type CreateQuestionOptionForm = {
    optionId: OptionId;
    textEn: string;
    textHi: string;
};

type CreateQuestionForm = {
    questionTextEn: string;
    questionTextHi: string;
    subject: string;
    topic: string;
    subTopic: string;
    sourceType: "original" | "pyq";
    difficulty: "easy" | "medium" | "hard";
    marks: string;
    negativeMarks: string;
    correctOptionId: OptionId;
    explanationEn: string;
    explanationHi: string;
    questionGroupId: string;
    groupQuestionOrder: string;
    options: CreateQuestionOptionForm[];
};

type ToastState = {
    type: "success" | "error";
    message: string;
};

const initialCreateQuestionForm: CreateQuestionForm = {
    questionTextEn: "",
    questionTextHi: "",
    subject: "",
    topic: "",
    subTopic: "",
    sourceType: "original",
    difficulty: "medium",
    marks: "1",
    negativeMarks: "0",
    correctOptionId: "A",
    explanationEn: "",
    explanationHi: "",
    questionGroupId: "",
    groupQuestionOrder: "",
    options: OPTION_IDS.map((optionId) => ({
        optionId,
        textEn: "",
        textHi: "",
    })),
};

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role));
};

const hasText = (value: string) => {
    return value.trim().length > 0;
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const getQuestionGroupSummary = (
    questionGroupId?: QuestionGroupSummary | string | null
) => {
    if (!questionGroupId || typeof questionGroupId === "string") {
        return null;
    }

    return questionGroupId;
};

const getCategorySummary = (categoryId?: CategorySummary | string | null) => {
    if (!categoryId || typeof categoryId === "string") {
        return null;
    }

    return categoryId;
};

export default function AdminQuestionBankPage() {
    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [message, setMessage] = useState("");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [questionGroups, setQuestionGroups] = useState<QuestionGroupSummary[]>(
        []
    );
    const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
    const [isQuestionGroupsLoading, setIsQuestionGroupsLoading] =
        useState(false);
    const [questionsError, setQuestionsError] = useState("");
    const [questionGroupsError, setQuestionGroupsError] = useState("");
    const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
    const [isCreateSaving, setIsCreateSaving] = useState(false);
    const [editingQuestionId, setEditingQuestionId] = useState("");
    const [createQuestionForm, setCreateQuestionForm] =
        useState<CreateQuestionForm>(initialCreateQuestionForm);
    const [toast, setToast] = useState<ToastState | null>(null);

    const showToast = (nextToast: ToastState) => {
        setToast(nextToast);

        window.setTimeout(() => {
            setToast(null);
        }, 3000);
    };

    const loadQuestions = async (savedToken: string) => {
        setIsQuestionsLoading(true);
        setQuestionsError("");

        try {
            const response = await fetch(API_BASE_URL + "/api/questions", {
                headers: {
                    Authorization: "Bearer " + savedToken,
                },
            });

            const result = (await response.json()) as QuestionsResponse;

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
                throw new Error(result.message || "Unable to load questions.");
            }

            setQuestions(result.data || []);
        } catch (error) {
            setQuestionsError(
                error instanceof Error
                    ? error.message
                    : "Unable to load questions."
            );
        } finally {
            setIsQuestionsLoading(false);
        }
    };

    const loadQuestionGroups = async (savedToken: string) => {
        setIsQuestionGroupsLoading(true);
        setQuestionGroupsError("");

        try {
            const response = await fetch(API_BASE_URL + "/api/question-groups", {
                headers: {
                    Authorization: "Bearer " + savedToken,
                },
            });

            const result = (await response.json()) as QuestionGroupsResponse;

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
                    result.message || "Unable to load question groups."
                );
            }

            setQuestionGroups(result.data || []);
        } catch (error) {
            setQuestionGroupsError(
                error instanceof Error
                    ? error.message
                    : "Unable to load question groups."
            );
        } finally {
            setIsQuestionGroupsLoading(false);
        }
    };

    const updateCreateQuestionForm = (
        field: keyof Omit<CreateQuestionForm, "options">,
        value: string
    ) => {
        setCreateQuestionForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const updateCreateOption = (
        optionId: OptionId,
        field: "textEn" | "textHi",
        value: string
    ) => {
        setCreateQuestionForm((current) => ({
            ...current,
            options: current.options.map((option) =>
                option.optionId === optionId
                    ? {
                          ...option,
                          [field]: value,
                      }
                    : option
            ),
        }));
    };

    const resetCreateQuestionForm = () => {
        setCreateQuestionForm(initialCreateQuestionForm);
    };

    const getEditableOptionValue = (
        question: Question,
        optionId: OptionId,
        field: "textEn" | "textHi"
    ) => {
        return (
            question.options?.find((option) => option.optionId === optionId)?.[
                field
            ] || ""
        );
    };

    const startEditQuestion = (question: Question) => {
        const group = getQuestionGroupSummary(question.questionGroupId);

        setEditingQuestionId(question._id);
        setCreateQuestionForm({
            questionTextEn: question.questionTextEn || "",
            questionTextHi: question.questionTextHi || "",
            subject: question.subject || "",
            topic: question.topic || "",
            subTopic: question.subTopic || "",
            sourceType:
                question.sourceType === "pyq" ? "pyq" : "original",
            difficulty:
                question.difficulty === "easy" ||
                question.difficulty === "hard"
                    ? question.difficulty
                    : "medium",
            marks: String(question.marks ?? 1),
            negativeMarks: String(question.negativeMarks ?? 0),
            correctOptionId: OPTION_IDS.includes(
                question.correctOptionId as OptionId
            )
                ? (question.correctOptionId as OptionId)
                : "A",
            explanationEn: question.explanationEn || "",
            explanationHi: question.explanationHi || "",
            questionGroupId: group?._id || "",
            groupQuestionOrder: question.groupQuestionOrder
                ? String(question.groupQuestionOrder)
                : "",
            options: OPTION_IDS.map((optionId) => ({
                optionId,
                textEn: getEditableOptionValue(question, optionId, "textEn"),
                textHi: getEditableOptionValue(question, optionId, "textHi"),
            })),
        });
        setIsCreateFormOpen(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const cancelEditQuestion = () => {
        setEditingQuestionId("");
        resetCreateQuestionForm();
        setIsCreateFormOpen(false);
    };

    const buildCreateQuestionPayload = () => {
        const filledOptions = createQuestionForm.options
            .filter((option) => hasText(option.textEn) || hasText(option.textHi))
            .map((option) => ({
                optionId: option.optionId,
                textEn: option.textEn.trim(),
                textHi: option.textHi.trim(),
                imageUrl: "",
            }));

        const marks = Number(createQuestionForm.marks);
        const negativeMarks = Number(createQuestionForm.negativeMarks);

        return {
            questionType: "mcq",
            sourceType: createQuestionForm.sourceType,
            questionTextEn: createQuestionForm.questionTextEn.trim(),
            questionTextHi: createQuestionForm.questionTextHi.trim(),
            questionImageUrl: "",
            subject: createQuestionForm.subject.trim(),
            topic: createQuestionForm.topic.trim(),
            subTopic: createQuestionForm.subTopic.trim(),
            difficulty: createQuestionForm.difficulty,
            marks,
            negativeMarks,
            options: filledOptions,
            correctOptionId: createQuestionForm.correctOptionId,
            explanationEn: createQuestionForm.explanationEn.trim(),
            explanationHi: createQuestionForm.explanationHi.trim(),
            questionGroupId: createQuestionForm.questionGroupId || null,
            groupQuestionOrder: createQuestionForm.questionGroupId
                ? Number(createQuestionForm.groupQuestionOrder)
                : null,
        };
    };

    const validateCreateQuestionForm = () => {
        if (
            !hasText(createQuestionForm.questionTextEn) &&
            !hasText(createQuestionForm.questionTextHi)
        ) {
            return "Question text is required.";
        }

        const marks = Number(createQuestionForm.marks);
        const negativeMarks = Number(createQuestionForm.negativeMarks);

        if (!Number.isFinite(marks) || marks < 0) {
            return "Marks must be zero or more.";
        }

        if (!Number.isFinite(negativeMarks) || negativeMarks < 0) {
            return "Negative marks must be zero or more.";
        }

        const filledOptions = createQuestionForm.options.filter(
            (option) => hasText(option.textEn) || hasText(option.textHi)
        );

        if (filledOptions.length < 2) {
            return "At least two options are required.";
        }

        if (
            !filledOptions.some(
                (option) =>
                    option.optionId === createQuestionForm.correctOptionId
            )
        ) {
            return "Correct option must have option text.";
        }

        if (createQuestionForm.questionGroupId) {
            const order = Number(createQuestionForm.groupQuestionOrder);

            if (!Number.isInteger(order) || order < 1) {
                return "Group question order must be a positive integer.";
            }
        }

        return "";
    };

    const handleCreateQuestion = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const validationError = validateCreateQuestionForm();

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
            const response = await fetch(API_BASE_URL + "/api/questions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + savedToken,
                },
                body: JSON.stringify(buildCreateQuestionPayload()),
            });

            const result = (await response.json()) as QuestionMutationResponse;

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
                throw new Error(result.message || "Unable to create question.");
            }

            const createdQuestion = result.data;

            setQuestions((current) => [
                createdQuestion,
                ...current.filter((question) => question._id !== createdQuestion._id),
            ]);

            resetCreateQuestionForm();
            setIsCreateFormOpen(false);
            showToast({
                type: "success",
                message: "Question created successfully.",
            });
        } catch (error) {
            showToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to create question.",
            });
        } finally {
            setIsCreateSaving(false);
        }
    };

    const handleUpdateQuestion = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!editingQuestionId) {
            return;
        }

        const validationError = validateCreateQuestionForm();

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
                API_BASE_URL + "/api/questions/" + editingQuestionId,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + savedToken,
                    },
                    body: JSON.stringify(buildCreateQuestionPayload()),
                }
            );

            const result = (await response.json()) as QuestionMutationResponse;

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
                throw new Error(result.message || "Unable to update question.");
            }

            const updatedQuestion = result.data;

            setQuestions((current) =>
                current.map((question) =>
                    question._id === updatedQuestion._id
                        ? updatedQuestion
                        : question
                )
            );

            setEditingQuestionId("");
            resetCreateQuestionForm();
            setIsCreateFormOpen(false);
            showToast({
                type: "success",
                message: "Question updated successfully.",
            });
        } catch (error) {
            showToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to update question.",
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
                void loadQuestions(savedToken);
                void loadQuestionGroups(savedToken);
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
                                Question Bank
                            </h1>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Manage MCQ questions, options, correct answers,
                                explanations, difficulty, and optional question
                                group linking.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/admin/dashboard"
                                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Dashboard
                            </Link>
                        </div>
                    </div>
                </header>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {editingQuestionId
                                    ? "T-42N Step 4"
                                    : "T-42N Step 3"}
                            </p>

                            <h2 className="mt-2 text-xl font-bold">
                                {editingQuestionId
                                    ? "Edit MCQ Question"
                                    : "Create MCQ Question"}
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {editingQuestionId
                                    ? "Update a single-correct MCQ question safely."
                                    : "Add single-correct MCQ questions and optionally link them to an active question group."}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                if (editingQuestionId) {
                                    cancelEditQuestion();
                                    return;
                                }

                                setIsCreateFormOpen((value) => !value);
                            }}
                            className="w-fit rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                            {editingQuestionId
                                ? "Cancel Edit"
                                : isCreateFormOpen
                                  ? "Close Form"
                                  : "Add Question"}
                        </button>
                    </div>

                    {isCreateFormOpen ? (
                        <form
                            onSubmit={
                                editingQuestionId
                                    ? handleUpdateQuestion
                                    : handleCreateQuestion
                            }
                            className="mt-5 grid gap-5 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200"
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Question Text English
                                    <textarea
                                        value={createQuestionForm.questionTextEn}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "questionTextEn",
                                                event.target.value
                                            )
                                        }
                                        rows={4}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Enter English question text"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Question Text Hindi
                                    <textarea
                                        value={createQuestionForm.questionTextHi}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "questionTextHi",
                                                event.target.value
                                            )
                                        }
                                        rows={4}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Hindi question text"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Subject
                                    <input
                                        value={createQuestionForm.subject}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "subject",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Reasoning"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Topic
                                    <input
                                        value={createQuestionForm.topic}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "topic",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Seating Arrangement"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Sub Topic
                                    <input
                                        value={createQuestionForm.subTopic}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "subTopic",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Linear arrangement"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-5">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Source
                                    <select
                                        value={createQuestionForm.sourceType}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "sourceType",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    >
                                        <option value="original">Original</option>
                                        <option value="pyq">PYQ</option>
                                    </select>
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Difficulty
                                    <select
                                        value={createQuestionForm.difficulty}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "difficulty",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Marks
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.25"
                                        value={createQuestionForm.marks}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "marks",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Negative
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.25"
                                        value={createQuestionForm.negativeMarks}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "negativeMarks",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Correct Option
                                    <select
                                        value={createQuestionForm.correctOptionId}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "correctOptionId",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    >
                                        {OPTION_IDS.map((optionId) => (
                                            <option key={optionId} value={optionId}>
                                                {optionId}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-sm font-bold text-slate-950">
                                        Options
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        At least two options are required. Correct
                                        option must have text.
                                    </p>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    {createQuestionForm.options.map((option) => (
                                        <div
                                            key={option.optionId}
                                            className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
                                        >
                                            <p className="text-sm font-bold text-slate-900">
                                                Option {option.optionId}
                                            </p>

                                            <div className="mt-3 grid gap-3">
                                                <input
                                                    value={option.textEn}
                                                    onChange={(event) =>
                                                        updateCreateOption(
                                                            option.optionId,
                                                            "textEn",
                                                            event.target.value
                                                        )
                                                    }
                                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                                                    placeholder="English option text"
                                                />

                                                <input
                                                    value={option.textHi}
                                                    onChange={(event) =>
                                                        updateCreateOption(
                                                            option.optionId,
                                                            "textHi",
                                                            event.target.value
                                                        )
                                                    }
                                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                                                    placeholder="Hindi option text"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Explanation English
                                    <textarea
                                        value={createQuestionForm.explanationEn}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "explanationEn",
                                                event.target.value
                                            )
                                        }
                                        rows={3}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Optional explanation"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Explanation Hindi
                                    <textarea
                                        value={createQuestionForm.explanationHi}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "explanationHi",
                                                event.target.value
                                            )
                                        }
                                        rows={3}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Optional Hindi explanation"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100 md:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-blue-950">
                                    Optional Question Group
                                    <select
                                        value={createQuestionForm.questionGroupId}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "questionGroupId",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500"
                                    >
                                        <option value="">No group</option>
                                        {questionGroups.map((group) => (
                                            <option key={group._id} value={group._id}>
                                                {group.title || group.slug}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-xs font-normal text-blue-800">
                                        {isQuestionGroupsLoading
                                            ? "Loading active groups..."
                                            : questionGroups.length +
                                              " active groups available"}
                                    </span>
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-blue-950">
                                    Group Question Order
                                    <input
                                        type="number"
                                        min="1"
                                        value={createQuestionForm.groupQuestionOrder}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "groupQuestionOrder",
                                                event.target.value
                                            )
                                        }
                                        disabled={!createQuestionForm.questionGroupId}
                                        className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                                        placeholder="Required if group selected"
                                    />
                                    <span className="text-xs font-normal text-blue-800">
                                        Use 1, 2, 3... for questions inside a
                                        linked group.
                                    </span>
                                </label>

                                {questionGroupsError ? (
                                    <div className="md:col-span-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                                        {questionGroupsError}
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="submit"
                                    disabled={isCreateSaving}
                                    className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                    {isCreateSaving
                                        ? editingQuestionId
                                            ? "Saving..."
                                            : "Creating..."
                                        : editingQuestionId
                                          ? "Save Changes"
                                          : "Create Question"}
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        editingQuestionId
                                            ? cancelEditQuestion
                                            : resetCreateQuestionForm
                                    }
                                    disabled={isCreateSaving}
                                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                    {editingQuestionId ? "Cancel Edit" : "Reset"}
                                </button>
                            </div>
                        </form>
                    ) : null}
                </section>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                T-42N Step 2
                            </p>

                            <h2 className="mt-2 text-xl font-bold">
                                Question List
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                Connected to{" "}
                                <span className="font-semibold">
                                    /api/questions
                                </span>{" "}
                                for admin MCQ listing.
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
                                    void loadQuestions(savedToken);
                                    void loadQuestionGroups(savedToken);
                                }
                            }}
                            disabled={isQuestionsLoading}
                            className="w-fit rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                            {isQuestionsLoading
                                ? "Refreshing..."
                                : "Refresh List"}
                        </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Loaded Questions
                            </p>
                            <p className="mt-2 text-2xl font-bold">
                                {questions.length}
                            </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                API
                            </p>
                            <p className="mt-2 break-all text-sm font-semibold text-slate-700">
                                /api/questions
                            </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Scope
                            </p>
                            <p className="mt-2 text-sm font-semibold text-slate-700">
                                MCQ single-correct question bank
                            </p>
                        </div>
                    </div>

                    {questionsError ? (
                        <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                            {questionsError}
                        </div>
                    ) : null}

                    {isQuestionsLoading ? (
                        <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                            Loading questions...
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="mt-5 rounded-2xl bg-blue-50 p-5 text-sm text-blue-900 ring-1 ring-blue-100">
                            No questions found yet. Use Add Question to create
                            your first MCQ.
                        </div>
                    ) : (
                        <div className="mt-5 grid gap-4">
                            {questions.map((question) => {
                                const group = getQuestionGroupSummary(
                                    question.questionGroupId
                                );
                                const category = getCategorySummary(
                                    question.categoryId
                                );

                                return (
                                    <article
                                        key={question._id}
                                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                                    >
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                                        {question.questionType ||
                                                            "mcq"}
                                                    </span>
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                        {question.sourceType ||
                                                            "original"}
                                                    </span>
                                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                                        {question.difficulty ||
                                                            "medium"}
                                                    </span>
                                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                                        {question.isActive === false
                                                            ? "Inactive"
                                                            : "Active"}
                                                    </span>
                                                </div>

                                                <h3 className="mt-3 text-lg font-bold text-slate-950">
                                                    {question.questionTextEn ||
                                                        question.questionTextHi ||
                                                        "Untitled question"}
                                                </h3>

                                                {question.questionTextHi &&
                                                question.questionTextEn ? (
                                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                                        {question.questionTextHi}
                                                    </p>
                                                ) : null}
                                            </div>

                                            <div className="grid min-w-[170px] gap-3">
                                                <div className="rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Correct Option
                                                    </p>
                                                    <p className="mt-1 text-xl font-bold">
                                                        {question.correctOptionId ||
                                                            "-"}
                                                    </p>
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        +{question.marks ?? 1} / -
                                                        {question.negativeMarks ?? 0}
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        startEditQuestion(question)
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
                                                    Subject:
                                                </span>{" "}
                                                {question.subject || "-"}
                                            </p>
                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Topic:
                                                </span>{" "}
                                                {question.topic || "-"}
                                            </p>
                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Category:
                                                </span>{" "}
                                                {category?.name || "-"}
                                            </p>
                                        </div>

                                        {group ? (
                                            <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-100">
                                                <p className="font-semibold">
                                                    Linked Question Group
                                                </p>
                                                <p className="mt-1">
                                                    {group.title || group.slug}{" "}
                                                    - {group.groupType || "group"} -
                                                    {" "}
                                                    {group.displayMode || "auto"} -
                                                    {" "}
                                                    Order{" "}
                                                    {question.groupQuestionOrder ??
                                                        "-"}
                                                </p>
                                            </div>
                                        ) : null}

                                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                                            {(question.options || []).map(
                                                (option) => {
                                                    const isCorrect =
                                                        option.optionId ===
                                                        question.correctOptionId;

                                                    return (
                                                        <div
                                                            key={option.optionId}
                                                            className={
                                                                "rounded-2xl border p-4 text-sm " +
                                                                (isCorrect
                                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                                                    : "border-slate-200 bg-slate-50 text-slate-700")
                                                            }
                                                        >
                                                            <p className="font-bold">
                                                                {option.optionId}
                                                                {isCorrect
                                                                    ? " - Correct"
                                                                    : ""}
                                                            </p>
                                                            <p className="mt-2">
                                                                {option.textEn ||
                                                                    option.textHi ||
                                                                    option.imageUrl ||
                                                                    "-"}
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>

                                        {question.explanationEn ||
                                        question.explanationHi ? (
                                            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
                                                <p className="font-semibold text-slate-900">
                                                    Explanation
                                                </p>
                                                <p className="mt-1">
                                                    {question.explanationEn ||
                                                        question.explanationHi}
                                                </p>
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

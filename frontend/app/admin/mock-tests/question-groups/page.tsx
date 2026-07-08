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

const groupTypeOptions = [
    "passage",
    "cloze",
    "reasoning_set",
    "di_set",
    "match_column",
    "instruction_set",
    "statement_set",
    "caselet",
    "science_diagram",
    "math_set",
    "other",
];

const displayModeOptions = [
    "auto",
    "sticky",
    "split",
    "full_width",
    "collapsible",
];

const difficultyOptions = ["easy", "medium", "hard"];

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

type QuestionGroup = {
    _id: string;
    title: string;
    slug: string;
    description?: string;
    groupType?: string;
    subject?: string;
    topic?: string;
    subTopic?: string;
    instructionEn?: string;
    instructionHi?: string;
    passageEn?: string;
    passageHi?: string;
    displayMode?: string;
    expectedQuestionCount?: number;
    sourceType?: string;
    difficulty?: string;
    tags?: string[];
    contentBlocks?: unknown[];
    isActive?: boolean;
    createdAt?: string;
};

type QuestionGroupsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: QuestionGroup[];
};

type CreateQuestionGroupResponse = {
    success: boolean;
    message?: string;
    data?: QuestionGroup;
};

type CreateQuestionGroupForm = {
    title: string;
    slug: string;
    description: string;
    groupType: string;
    displayMode: string;
    expectedQuestionCount: string;
    subject: string;
    topic: string;
    subTopic: string;
    difficulty: string;
    instructionEn: string;
    instructionHi: string;
    passageEn: string;
    passageHi: string;
};

const defaultCreateGroupForm: CreateQuestionGroupForm = {
    title: "",
    slug: "",
    description: "",
    groupType: "instruction_set",
    displayMode: "auto",
    expectedQuestionCount: "0",
    subject: "",
    topic: "",
    subTopic: "",
    difficulty: "medium",
    instructionEn: "",
    instructionHi: "",
    passageEn: "",
    passageHi: "",
};

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role));
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const getTrimmedContentExists = (form: CreateQuestionGroupForm) => {
    return Boolean(
        form.instructionEn.trim() ||
            form.instructionHi.trim() ||
            form.passageEn.trim() ||
            form.passageHi.trim()
    );
};

export default function AdminQuestionGroupsPage() {
    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [message, setMessage] = useState("");
    const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([]);
    const [isGroupsLoading, setIsGroupsLoading] = useState(false);
    const [groupsError, setGroupsError] = useState("");
    const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
    const [createGroupForm, setCreateGroupForm] =
        useState<CreateQuestionGroupForm>(defaultCreateGroupForm);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [createGroupMessage, setCreateGroupMessage] = useState("");
    const [createGroupError, setCreateGroupError] = useState("");
    const [includeInactiveGroups, setIncludeInactiveGroups] = useState(false);
    const [groupActionId, setGroupActionId] = useState("");
    const [editingGroupId, setEditingGroupId] = useState("");

    const createGroupValidationErrors = (() => {
        const errors: string[] = [];

        if (!createGroupForm.title.trim()) {
            errors.push("Title is required.");
        }

        if (!createGroupForm.slug.trim()) {
            errors.push("Slug is required.");
        }

        if (!groupTypeOptions.includes(createGroupForm.groupType)) {
            errors.push("Invalid group type.");
        }

        if (!displayModeOptions.includes(createGroupForm.displayMode)) {
            errors.push("Invalid display mode.");
        }

        if (!difficultyOptions.includes(createGroupForm.difficulty)) {
            errors.push("Invalid difficulty.");
        }

        const expectedQuestionCount = Number(
            createGroupForm.expectedQuestionCount || 0
        );

        if (
            !Number.isInteger(expectedQuestionCount) ||
            expectedQuestionCount < 0
        ) {
            errors.push("Expected question count must be 0 or a positive number.");
        }

        if (!getTrimmedContentExists(createGroupForm)) {
            errors.push(
                "Add at least one instruction or passage in English/Hindi."
            );
        }

        return errors;
    })();

    const updateCreateGroupField = (
        field: keyof CreateQuestionGroupForm,
        value: string
    ) => {
        setCreateGroupMessage("");
        setCreateGroupError("");

        setCreateGroupForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const buildQuestionGroupPayload = () => ({
        title: createGroupForm.title.trim(),
        slug: createGroupForm.slug.trim(),
        description: createGroupForm.description.trim(),
        groupType: createGroupForm.groupType,
        displayMode: createGroupForm.displayMode,
        expectedQuestionCount: Number(
            createGroupForm.expectedQuestionCount || 0
        ),
        subject: createGroupForm.subject.trim(),
        topic: createGroupForm.topic.trim(),
        subTopic: createGroupForm.subTopic.trim(),
        difficulty: createGroupForm.difficulty,
        instructionEn: createGroupForm.instructionEn.trim(),
        instructionHi: createGroupForm.instructionHi.trim(),
        passageEn: createGroupForm.passageEn.trim(),
        passageHi: createGroupForm.passageHi.trim(),
        sourceType: "original",
        contentBlocks: [],
    });

    const loadQuestionGroups = async (
        savedToken: string,
        includeInactive = includeInactiveGroups
    ) => {
        setIsGroupsLoading(true);
        setGroupsError("");

        try {
            const queryString = includeInactive ? "?includeInactive=true" : "";

            const response = await fetch(
                API_BASE_URL + "/api/question-groups" + queryString,
                {
                    headers: {
                        Authorization: "Bearer " + savedToken,
                    },
                }
            );

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
                throw new Error(result.message || "Unable to load question groups.");
            }

            setQuestionGroups(result.data || []);
        } catch (error) {
            setGroupsError(
                error instanceof Error
                    ? error.message
                    : "Unable to load question groups."
            );
        } finally {
            setIsGroupsLoading(false);
        }
    };

    const handleCreateQuestionGroup = async () => {
        if (createGroupValidationErrors.length > 0 || isCreatingGroup) {
            return;
        }

        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        if (!savedToken) {
            setCreateGroupMessage("");
            setCreateGroupError("Admin session expired. Please login again.");
            return;
        }

        const payload = buildQuestionGroupPayload();

        setIsCreatingGroup(true);
        setCreateGroupMessage("");
        setCreateGroupError("");

        try {
            const response = await fetch(
                API_BASE_URL + "/api/question-groups",
                {
                    method: "POST",
                    headers: {
                        Authorization: "Bearer " + savedToken,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const result = (await response.json()) as CreateQuestionGroupResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success || !result.data) {
                throw new Error(result.message || "Unable to create question group.");
            }

            setQuestionGroups((current) => [
                result.data as QuestionGroup,
                ...current.filter((group) => group._id !== result.data?._id),
            ]);
            setCreateGroupForm(defaultCreateGroupForm);
            setCreateGroupMessage(
                "Question group created successfully and list updated."
            );
            setCreateGroupError("");
            setIsCreateFormOpen(false);
        } catch (error) {
            setCreateGroupMessage("");
            setCreateGroupError(
                error instanceof Error
                    ? error.message
                    : "Unable to create question group."
            );
        } finally {
            setIsCreatingGroup(false);
        }
    };

    useEffect(() => {
        if (!createGroupMessage && !createGroupError) {
            return;
        }

        const messageTimer = window.setTimeout(() => {
            setCreateGroupMessage("");
            setCreateGroupError("");
        }, 3000);

        return () => {
            window.clearTimeout(messageTimer);
        };
    }, [createGroupMessage, createGroupError]);

    const createGroupToastMessage = createGroupMessage || createGroupError;

    const handleStartEditQuestionGroup = (group: QuestionGroup) => {
        setEditingGroupId(group._id);
        setCreateGroupMessage("");
        setCreateGroupError("");
        setCreateGroupForm({
            title: group.title || "",
            slug: group.slug || "",
            description: group.description || "",
            groupType: group.groupType || "instruction_set",
            displayMode: group.displayMode || "auto",
            expectedQuestionCount: String(group.expectedQuestionCount ?? 0),
            subject: group.subject || "",
            topic: group.topic || "",
            subTopic: group.subTopic || "",
            difficulty: group.difficulty || "medium",
            instructionEn: group.instructionEn || "",
            instructionHi: group.instructionHi || "",
            passageEn: group.passageEn || "",
            passageHi: group.passageHi || "",
        });
        setIsCreateFormOpen(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCancelEditQuestionGroup = () => {
        setEditingGroupId("");
        setCreateGroupForm(defaultCreateGroupForm);
        setCreateGroupMessage("");
        setCreateGroupError("");
        setIsCreateFormOpen(false);
    };

    const handleUpdateQuestionGroup = async () => {
        if (
            !editingGroupId ||
            createGroupValidationErrors.length > 0 ||
            isCreatingGroup
        ) {
            return;
        }

        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        if (!savedToken) {
            setCreateGroupMessage("");
            setCreateGroupError("Admin session expired. Please login again.");
            return;
        }

        setIsCreatingGroup(true);
        setCreateGroupMessage("");
        setCreateGroupError("");

        try {
            const response = await fetch(
                API_BASE_URL + "/api/question-groups/" + editingGroupId,
                {
                    method: "PUT",
                    headers: {
                        Authorization: "Bearer " + savedToken,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(buildQuestionGroupPayload()),
                }
            );

            const result = (await response.json()) as CreateQuestionGroupResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success || !result.data) {
                throw new Error(result.message || "Unable to update question group.");
            }

            setQuestionGroups((current) =>
                current.map((group) =>
                    group._id === result.data?._id
                        ? (result.data as QuestionGroup)
                        : group
                )
            );

            setEditingGroupId("");
            setCreateGroupForm(defaultCreateGroupForm);
            setIsCreateFormOpen(false);
            setCreateGroupMessage("Question group updated successfully.");
        } catch (error) {
            setCreateGroupError(
                error instanceof Error
                    ? error.message
                    : "Unable to update question group."
            );
        } finally {
            setIsCreatingGroup(false);
        }
    };

    const handleToggleIncludeInactiveGroups = (checked: boolean) => {
        setIncludeInactiveGroups(checked);

        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        if (savedToken) {
            void loadQuestionGroups(savedToken, checked);
        }
    };

    const handleDisableQuestionGroup = async (group: QuestionGroup) => {
        if (groupActionId || group.isActive === false) {
            return;
        }

        const confirmed = window.confirm(
            `Disable question group "${group.title}"?\n\nDisabled groups cannot be attached to new questions, but existing published snapshots remain safe.`
        );

        if (!confirmed) {
            return;
        }

        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        if (!savedToken) {
            setCreateGroupError("Admin session expired. Please login again.");
            return;
        }

        setGroupActionId(group._id);
        setCreateGroupMessage("");
        setCreateGroupError("");

        try {
            const response = await fetch(
                API_BASE_URL + "/api/question-groups/" + group._id + "/disable",
                {
                    method: "PATCH",
                    headers: {
                        Authorization: "Bearer " + savedToken,
                    },
                }
            );

            const result = (await response.json()) as CreateQuestionGroupResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success || !result.data) {
                throw new Error(result.message || "Unable to disable question group.");
            }

            setQuestionGroups((current) => {
                if (!includeInactiveGroups) {
                    return current.filter((item) => item._id !== group._id);
                }

                return current.map((item) =>
                    item._id === group._id
                        ? {
                              ...item,
                              isActive: false,
                          }
                        : item
                );
            });

            setCreateGroupMessage("Question group disabled successfully.");
        } catch (error) {
            setCreateGroupError(
                error instanceof Error
                    ? error.message
                    : "Unable to disable question group."
            );
        } finally {
            setGroupActionId("");
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
            {createGroupToastMessage ? (
                <div
                    role="status"
                    aria-live="polite"
                    className={`fixed left-4 right-4 top-24 z-50 mx-auto max-w-xl rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg lg:left-auto lg:right-6 lg:mx-0 lg:w-[420px] ${
                        createGroupError
                            ? "border-red-100 bg-red-50 text-red-700"
                            : "border-emerald-100 bg-emerald-50 text-emerald-700"
                    }`}
                >
                    {createGroupToastMessage}
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
                                Question Groups
                            </h1>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Manage passages, instructions, tables, images,
                                math blocks, and grouped question stimulus content.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/admin/dashboard"
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Dashboard
                            </Link>

                            <Link
                                href="/admin/mock-tests/exam-patterns"
                                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Exam Patterns
                            </Link>
                        </div>
                    </div>
                </header>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {editingGroupId ? "T-42M Step 5" : "T-42M Step 3"}
                            </p>

                            <h2 className="mt-2 text-xl font-bold">
                                {editingGroupId
                                    ? "Edit Question Group"
                                    : "Create Question Group"}
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {editingGroupId
                                    ? "Update selected grouped stimulus content."
                                    : "Create reusable grouped stimulus content before attaching questions in the question bank."}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                if (editingGroupId && isCreateFormOpen) {
                                    handleCancelEditQuestionGroup();
                                    return;
                                }

                                setIsCreateFormOpen((current) => !current);
                            }}
                            className="w-fit rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                            {isCreateFormOpen
                                ? editingGroupId
                                    ? "Cancel Edit"
                                    : "Close Form"
                                : "Create Group"}
                        </button>
                    </div>

                    {isCreateFormOpen ? (
                        <div className="mt-5 grid gap-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Title
                                    <input
                                        value={createGroupForm.title}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "title",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="Active Banking Seating Group"
                                    />
                                </label>

                                <label className="text-sm font-semibold text-slate-700">
                                    Slug
                                    <input
                                        value={createGroupForm.slug}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "slug",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="active-banking-seating-group"
                                    />
                                </label>
                            </div>

                            <label className="text-sm font-semibold text-slate-700">
                                Description
                                <textarea
                                    value={createGroupForm.description}
                                    onChange={(event) =>
                                        updateCreateGroupField(
                                            "description",
                                            event.target.value
                                        )
                                    }
                                    className="mt-2 min-h-20 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    placeholder="Short internal description"
                                />
                            </label>

                            <div className="grid gap-4 md:grid-cols-4">
                                <label className="text-sm font-semibold text-slate-700">
                                    Group Type
                                    <select
                                        value={createGroupForm.groupType}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "groupType",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    >
                                        {groupTypeOptions.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="text-sm font-semibold text-slate-700">
                                    Display Mode
                                    <select
                                        value={createGroupForm.displayMode}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "displayMode",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    >
                                        {displayModeOptions.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="text-sm font-semibold text-slate-700">
                                    Expected Qs
                                    <input
                                        value={createGroupForm.expectedQuestionCount}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "expectedQuestionCount",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="5"
                                        type="number"
                                        min="0"
                                    />
                                </label>

                                <label className="text-sm font-semibold text-slate-700">
                                    Difficulty
                                    <select
                                        value={createGroupForm.difficulty}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "difficulty",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    >
                                        {difficultyOptions.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <label className="text-sm font-semibold text-slate-700">
                                    Subject
                                    <input
                                        value={createGroupForm.subject}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "subject",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="Reasoning"
                                    />
                                </label>

                                <label className="text-sm font-semibold text-slate-700">
                                    Topic
                                    <input
                                        value={createGroupForm.topic}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "topic",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="Seating Arrangement"
                                    />
                                </label>

                                <label className="text-sm font-semibold text-slate-700">
                                    Sub Topic
                                    <input
                                        value={createGroupForm.subTopic}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "subTopic",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="Linear Arrangement"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Instruction English
                                    <textarea
                                        value={createGroupForm.instructionEn}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "instructionEn",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="Read the arrangement carefully."
                                    />
                                </label>

                                <label className="text-sm font-semibold text-slate-700">
                                    Instruction Hindi
                                    <textarea
                                        value={createGroupForm.instructionHi}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "instructionHi",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="Enter Hindi instruction text here."
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Passage English
                                    <textarea
                                        value={createGroupForm.passageEn}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "passageEn",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 min-h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="A, B, C, D and E are sitting..."
                                    />
                                </label>

                                <label className="text-sm font-semibold text-slate-700">
                                    Passage Hindi
                                    <textarea
                                        value={createGroupForm.passageHi}
                                        onChange={(event) =>
                                            updateCreateGroupField(
                                                "passageHi",
                                                event.target.value
                                            )
                                        }
                                        className="mt-2 min-h-28 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="Enter Hindi passage text here."
                                    />
                                </label>
                            </div>

                            {createGroupValidationErrors.length > 0 ? (
                                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
                                    <p className="font-semibold">
                                        Complete these fields:
                                    </p>
                                    <ul className="mt-2 list-disc space-y-1 pl-5">
                                        {createGroupValidationErrors.map(
                                            (error) => (
                                                <li key={error}>{error}</li>
                                            )
                                        )}
                                    </ul>
                                </div>
                            ) : null}

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() =>
                                        editingGroupId
                                            ? void handleUpdateQuestionGroup()
                                            : void handleCreateQuestionGroup()
                                    }
                                    disabled={
                                        isCreatingGroup ||
                                        createGroupValidationErrors.length > 0
                                    }
                                    className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                    {isCreatingGroup
                                        ? editingGroupId
                                            ? "Saving..."
                                            : "Creating..."
                                        : editingGroupId
                                          ? "Save Changes"
                                          : "Create Question Group"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (editingGroupId) {
                                            handleCancelEditQuestionGroup();
                                            return;
                                        }

                                        setCreateGroupForm(
                                            defaultCreateGroupForm
                                        );
                                        setCreateGroupMessage("");
                                        setCreateGroupError("");
                                    }}
                                    disabled={isCreatingGroup}
                                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                                >
                                    {editingGroupId ? "Cancel Edit" : "Reset"}
                                </button>
                            </div>

                            {createGroupError ? (
                                <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                                    {createGroupError}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </section>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Question Groups
                            </p>

                            <h2 className="mt-2 text-xl font-bold">
                                Question Group List
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                Connected to{" "}
                                <span className="font-semibold">
                                    /api/question-groups
                                </span>{" "}
                                for listing grouped stimulus content.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={includeInactiveGroups}
                                    onChange={(event) =>
                                        handleToggleIncludeInactiveGroups(
                                            event.target.checked
                                        )
                                    }
                                    className="h-4 w-4"
                                />
                                Show inactive
                            </label>

                            <button
                                type="button"
                                onClick={() => {
                                    const savedToken =
                                        window.localStorage.getItem(
                                            ADMIN_TOKEN_STORAGE_KEY
                                        ) || "";

                                    if (savedToken) {
                                        void loadQuestionGroups(savedToken);
                                    }
                                }}
                                disabled={isGroupsLoading}
                                className="w-fit rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                                {isGroupsLoading ? "Refreshing..." : "Refresh List"}
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Loaded Groups
                            </p>
                            <p className="mt-2 text-2xl font-bold">
                                {questionGroups.length}
                            </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                API
                            </p>
                            <p className="mt-2 break-all text-sm font-semibold text-slate-700">
                                /api/question-groups
                            </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Scope
                            </p>
                            <p className="mt-2 text-sm font-semibold text-slate-700">
                                {includeInactiveGroups
                                    ? "Active and inactive grouped stimulus"
                                    : "Active grouped stimulus content"}
                            </p>
                        </div>
                    </div>

                    {groupsError ? (
                        <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                            {groupsError}
                        </div>
                    ) : null}

                    {isGroupsLoading ? (
                        <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                            Loading question groups...
                        </div>
                    ) : questionGroups.length === 0 ? (
                        <div className="mt-5 rounded-2xl bg-blue-50 p-5 text-sm text-blue-900 ring-1 ring-blue-100">
                            No active question groups found yet.
                        </div>
                    ) : (
                        <div className="mt-5 grid gap-4">
                            {questionGroups.map((group) => (
                                <article
                                    key={group._id}
                                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                                    {group.groupType || "group"}
                                                </span>
                                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                    {group.displayMode || "auto"}
                                                </span>
                                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                                    {group.isActive === false
                                                        ? "Inactive"
                                                        : "Active"}
                                                </span>
                                            </div>

                                            <h3 className="mt-3 text-lg font-bold text-slate-950">
                                                {group.title}
                                            </h3>

                                            <p className="mt-1 text-sm text-slate-500">
                                                Slug: {group.slug}
                                            </p>

                                            {group.description ? (
                                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                                    {group.description}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="flex min-w-[160px] flex-col gap-3">
                                            <div className="rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Expected Qs
                                                </p>
                                                <p className="mt-1 text-lg font-bold">
                                                    {group.expectedQuestionCount ?? "-"}
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleStartEditQuestionGroup(
                                                        group
                                                    )
                                                }
                                                disabled={Boolean(groupActionId)}
                                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                            >
                                                Edit
                                            </button>

                                            {group.isActive === false ? (
                                                <span className="rounded-2xl bg-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
                                                    Disabled
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void handleDisableQuestionGroup(
                                                            group
                                                        )
                                                    }
                                                    disabled={groupActionId === group._id}
                                                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:text-red-300"
                                                >
                                                    {groupActionId === group._id
                                                        ? "Disabling..."
                                                        : "Disable"}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                                        <p>
                                            <span className="font-semibold text-slate-800">
                                                Subject:
                                            </span>{" "}
                                            {group.subject || "-"}
                                        </p>
                                        <p>
                                            <span className="font-semibold text-slate-800">
                                                Topic:
                                            </span>{" "}
                                            {group.topic || "-"}
                                        </p>
                                        <p>
                                            <span className="font-semibold text-slate-800">
                                                Difficulty:
                                            </span>{" "}
                                            {group.difficulty || "-"}
                                        </p>
                                    </div>

                                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
                                        {group.instructionEn ||
                                        group.instructionHi ||
                                        group.passageEn ||
                                        group.passageHi ? (
                                            <p>
                                                {group.instructionEn ||
                                                    group.instructionHi ||
                                                    group.passageEn ||
                                                    group.passageHi}
                                            </p>
                                        ) : (
                                            <p>
                                                Content blocks:{" "}
                                                {group.contentBlocks?.length || 0}
                                            </p>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

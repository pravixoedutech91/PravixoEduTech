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

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role));
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

export default function AdminQuestionGroupsPage() {
    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [message, setMessage] = useState("");
    const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([]);
    const [isGroupsLoading, setIsGroupsLoading] = useState(false);
    const [groupsError, setGroupsError] = useState("");

    const loadQuestionGroups = async (savedToken: string) => {
        setIsGroupsLoading(true);
        setGroupsError("");

        try {
            const response = await fetch(
                API_BASE_URL + "/api/question-groups",
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
                                T-42M Step 2
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
                                Active grouped stimulus content
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
                            No active question groups found yet. The create form
                            will be added in the next step.
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

                                        <div className="min-w-[160px] rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Expected Qs
                                            </p>
                                            <p className="mt-1 text-lg font-bold">
                                                {group.expectedQuestionCount ?? "-"}
                                            </p>
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

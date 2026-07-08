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

type QuestionGroupSummary = {
    _id: string;
    title?: string;
    slug?: string;
    groupType?: string;
    displayMode?: string;
    isActive?: boolean;
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

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role));
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
    const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
    const [questionsError, setQuestionsError] = useState("");

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
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Dashboard
                            </Link>

                            <Link
                                href="/admin/mock-tests/question-groups"
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Question Groups
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
                            No questions found yet. The create form will be added
                            in the next step.
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

                                            <div className="min-w-[170px] rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
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

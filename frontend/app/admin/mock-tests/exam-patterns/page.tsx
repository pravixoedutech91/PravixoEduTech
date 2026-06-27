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

type ExamPatternSection = {
    name?: string;
    sectionType?: string;
    durationMinutes?: number;
    questionCount?: number;
};

type ExamPattern = {
    _id: string;
    name: string;
    slug: string;
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

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role));
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

export default function AdminExamPatternsPage() {
    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [message, setMessage] = useState("");
    const [patterns, setPatterns] = useState<ExamPattern[]>([]);
    const [isPatternsLoading, setIsPatternsLoading] = useState(false);
    const [patternsError, setPatternsError] = useState("");
    const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);

    useEffect(() => {
        const verifyAdminSession = async () => {
            const savedToken =
                window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

            if (!savedToken) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage("Please login with an admin account.");
                setIsReady(true);
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                    headers: {
                        Authorization: `Bearer ${savedToken}`,
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
                setIsPatternsLoading(true);

                try {
                    const patternsResponse = await fetch(
                        `${API_BASE_URL}/api/exam-patterns`,
                        {
                            headers: {
                                Authorization: `Bearer ${savedToken}`,
                            },
                        }
                    );

                    const patternsResult =
                        (await patternsResponse.json()) as ExamPatternsResponse;

                    if (
                        !patternsResponse.ok ||
                        !patternsResult.success ||
                        !Array.isArray(patternsResult.data)
                    ) {
                        throw new Error(
                            patternsResult.message || "Unable to load exam patterns."
                        );
                    }

                    setPatterns(patternsResult.data);
                    setPatternsError("");
                } catch (patternError) {
                    setPatterns([]);
                    setPatternsError(
                        patternError instanceof Error
                            ? patternError.message
                            : "Unable to load exam patterns."
                    );
                } finally {
                    setIsPatternsLoading(false);
                }
            } catch (error) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage(
                    error instanceof Error
                        ? error.message
                        : "Admin session expired."
                );
            } finally {
                setIsReady(true);
            }
        };

        void verifyAdminSession();
    }, []);

    if (!isReady) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
                <section className="mx-auto max-w-5xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    Loading admin session...
                </section>
            </main>
        );
    }

    if (!isAllowed) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
                <section className="mx-auto max-w-5xl rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                        Admin Access
                    </p>

                    <h1 className="mt-3 text-2xl font-bold">Login required</h1>

                    <p className="mt-3 text-sm text-slate-600">
                        {message || "Please login with an admin account."}
                    </p>

                    <Link
                        href="/admin/login"
                        className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                        Go to Admin Login
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
            <section className="mx-auto max-w-5xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <Link
                    href="/admin/dashboard"
                    className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                >
                    Back to Admin Dashboard
                </Link>

                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                    Mock-Test Module
                </p>

                <h1 className="mt-3 text-3xl font-bold">Exam Patterns</h1>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                    This protected admin page will manage exam structures, sections,
                    duration, marks, negative marking, and navigation rules.
                </p>

                <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-bold">Create Exam Pattern</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Form shell only. No API submit yet.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsCreateFormOpen((value) => !value)}
                        className="w-fit rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                        {isCreateFormOpen ? "Close Form" : "Create Pattern"}
                    </button>
                </div>

                {isCreateFormOpen ? (
                    <section className="mt-4 rounded-3xl border border-dashed border-blue-200 bg-blue-50 p-5">
                        <h2 className="text-lg font-bold">New Exam Pattern</h2>
                        <p className="mt-2 text-sm leading-6 text-blue-900">
                            Basic fields only. Save API will be added later.
                        </p>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <label className="grid gap-2 text-sm font-semibold text-slate-800">
                                Pattern Name
                                <input
                                    placeholder="Example: SSC CGL Tier 1"
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-400"
                                />
                            </label>

                            <label className="grid gap-2 text-sm font-semibold text-slate-800">
                                Slug
                                <input
                                    placeholder="example: ssc-cgl-tier-1"
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-400"
                                />
                            </label>

                            <label className="grid gap-2 text-sm font-semibold text-slate-800">
                                Exam Type
                                <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-400">
                                    <option value="custom">Custom</option>
                                    <option value="ssc">SSC</option>
                                    <option value="railway">Railway</option>
                                    <option value="banking">Banking</option>
                                    <option value="upsc">UPSC</option>
                                    <option value="state_exam">State Exam</option>
                                    <option value="cpct">CPCT</option>
                                </select>
                            </label>

                            <label className="grid gap-2 text-sm font-semibold text-slate-800">
                                Total Duration Minutes
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Example: 60"
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-400"
                                />
                            </label>

                            <label className="grid gap-2 text-sm font-semibold text-slate-800 sm:col-span-2">
                                Description
                                <textarea
                                    rows={3}
                                    placeholder="Short admin note about this exam pattern"
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-400"
                                />
                            </label>
                        </div>
                    </section>
                ) : null}

                <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-100">
                    {isPatternsLoading
                        ? "Loading exam patterns..."
                        : patternsError
                          ? patternsError
                          : `Existing exam patterns loaded: ${patterns.length}.`}
                </div>

                {!isPatternsLoading && !patternsError && patterns.length > 0 ? (
                    <section className="mt-6 grid gap-4">
                        {patterns.map((pattern) => {
                            const sections = pattern.sections || [];
                            const totalQuestions = sections.reduce(
                                (total, section) =>
                                    total + Number(section.questionCount || 0),
                                0
                            );

                            return (
                                <article
                                    key={pattern._id}
                                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h2 className="text-lg font-bold">
                                                {pattern.name}
                                            </h2>
                                            <p className="mt-1 text-sm text-slate-600">
                                                {pattern.description || pattern.slug}
                                            </p>
                                        </div>

                                        <span
                                            className={
                                                pattern.isActive
                                                    ? "w-fit rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-100"
                                                    : "w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                                            }
                                        >
                                            {pattern.isActive ? "Active" : "Inactive"}
                                        </span>
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                                        <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                                            <p className="text-xs font-semibold uppercase text-slate-500">
                                                Exam Type
                                            </p>
                                            <p className="mt-1 font-bold">
                                                {pattern.examType || "-"}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                                            <p className="text-xs font-semibold uppercase text-slate-500">
                                                Duration
                                            </p>
                                            <p className="mt-1 font-bold">
                                                {pattern.totalDurationMinutes || 0} min
                                            </p>
                                        </div>

                                        <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                                            <p className="text-xs font-semibold uppercase text-slate-500">
                                                Sections
                                            </p>
                                            <p className="mt-1 font-bold">
                                                {sections.length}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                                            <p className="text-xs font-semibold uppercase text-slate-500">
                                                Questions
                                            </p>
                                            <p className="mt-1 font-bold">
                                                {totalQuestions}
                                            </p>
                                        </div>
                                    </div>

                                    {sections.length > 0 ? (
                                        <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                            <p className="text-xs font-semibold uppercase text-slate-500">
                                                Section Preview
                                            </p>

                                            <div className="mt-3 grid gap-2">
                                                {sections.map((section, index) => (
                                                    <div
                                                        key={`${pattern._id}-section-${index}`}
                                                        className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                                                    >
                                                        <p className="font-semibold">
                                                            {index + 1}. {section.name || "Untitled section"}
                                                        </p>

                                                        <p className="text-slate-600">
                                                            {section.sectionType || "mcq"} · {section.questionCount || 0} questions · {section.durationMinutes || 0} min
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </article>
                            );
                        })}
                    </section>
                ) : null}
            </section>
        </main>
    );
}

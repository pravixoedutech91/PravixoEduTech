"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const ADMIN_TOKEN_STORAGE_KEY = "pravixoAdminToken";
const ADMIN_PROFILE_STORAGE_KEY = "pravixoAdminProfile";

const ALLOWED_ADMIN_ROLES = ["super_admin", "tenant_admin", "content_admin"] as const;

type AdminProfile = {
    id?: string;
    name?: string;
    email?: string;
    mobile?: string;
    tenantId?: string;
    role?: string;
};

type MeResponse = {
    success: boolean;
    message?: string;
    data?: AdminProfile;
};

type ContentType =
    | "article"
    | "study_note"
    | "notification"
    | "current_affairs"
    | "vacancy"
    | "admit_card"
    | "result"
    | "syllabus"
    | "exam_page";

type ContentStatus = "draft" | "published";

type CategorySummary = {
    _id?: string;
    name?: string;
    slug?: string;
};

type ContentItem = {
    _id: string;
    title?: string;
    slug?: string;
    type?: ContentType;
    category?: CategorySummary | string | null;
    summary?: string;
    status?: ContentStatus;
    seoTitle?: string;
    seoDescription?: string;
    publishedAt?: string;
    createdAt?: string;
    updatedAt?: string;
    tags?: string[];
};

type ContentListResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: ContentItem[];
};

type CategoryListResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: CategorySummary[];
};

const contentTypeOptions: Array<{
    value: ContentType;
    label: string;
    publicPath: string;
}> = [
    { value: "article", label: "Article", publicPath: "/articles" },
    { value: "study_note", label: "Study Note", publicPath: "/study-notes" },
    { value: "notification", label: "Notification", publicPath: "/notifications" },
    { value: "current_affairs", label: "Current Affairs", publicPath: "/current-affairs" },
    { value: "vacancy", label: "Vacancy", publicPath: "/vacancies" },
    { value: "admit_card", label: "Admit Card", publicPath: "/admit-cards" },
    { value: "result", label: "Result", publicPath: "/results" },
    { value: "syllabus", label: "Syllabus", publicPath: "/syllabus" },
    { value: "exam_page", label: "Exam Page", publicPath: "/exams" },
];

const contentTypeLabelMap = new Map(
    contentTypeOptions.map((option) => [option.value, option.label])
);

const contentTypePathMap = new Map(
    contentTypeOptions.map((option) => [option.value, option.publicPath])
);

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role as typeof ALLOWED_ADMIN_ROLES[number]));
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const formatDate = (value?: string) => {
    if (!value) {
        return "-";
    }

    try {
        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).format(new Date(value));
    } catch {
        return "-";
    }
};

const getCategoryName = (category?: CategorySummary | string | null) => {
    if (!category || typeof category === "string") {
        return "-";
    }

    return category.name || category.slug || "-";
};

const getContentTypeLabel = (type?: ContentType) => {
    if (!type) {
        return "-";
    }

    return contentTypeLabelMap.get(type) || type;
};

const getPublicPreviewHref = (content: ContentItem) => {
    if (!content.slug || !content.type) {
        return "";
    }

    const basePath = contentTypePathMap.get(content.type);

    if (!basePath) {
        return "";
    }

    return basePath + "/" + content.slug;
};

export default function AdminContentPage() {
    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [message, setMessage] = useState("");
    const [adminToken, setAdminToken] = useState("");
    const [profile, setProfile] = useState<AdminProfile | null>(null);

    const [contents, setContents] = useState<ContentItem[]>([]);
    const [categories, setCategories] = useState<CategorySummary[]>([]);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [contentError, setContentError] = useState("");

    const [typeFilter, setTypeFilter] = useState<"all" | ContentType>("all");
    const [statusFilter, setStatusFilter] = useState<"all" | ContentStatus>("all");
    const [searchTerm, setSearchTerm] = useState("");

    const loadContentData = async (token: string) => {
        setIsLoadingContent(true);
        setContentError("");

        try {
            const [contentResponse, categoryResponse] = await Promise.all([
                fetch(API_BASE_URL + "/api/content/admin/list", {
                    headers: {
                        Authorization: "Bearer " + token,
                    },
                }),
                fetch(API_BASE_URL + "/api/categories", {
                    headers: {
                        Authorization: "Bearer " + token,
                    },
                }),
            ]);

            const contentResult =
                (await contentResponse.json()) as ContentListResponse;

            if (!contentResponse.ok || !contentResult.success) {
                throw new Error(
                    contentResult.message || "Unable to load admin content."
                );
            }

            const categoryResult =
                (await categoryResponse.json()) as CategoryListResponse;

            if (!categoryResponse.ok || !categoryResult.success) {
                throw new Error(
                    categoryResult.message || "Unable to load categories."
                );
            }

            setContents(Array.isArray(contentResult.data) ? contentResult.data : []);
            setCategories(
                Array.isArray(categoryResult.data) ? categoryResult.data : []
            );
        } catch (error) {
            setContentError(
                error instanceof Error
                    ? error.message
                    : "Unable to load content data."
            );
        } finally {
            setIsLoadingContent(false);
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

                setAdminToken(savedToken);
                setProfile(result.data);
                setIsAllowed(true);
                setMessage("");

                await loadContentData(savedToken);
            } catch (error) {
                clearAdminSessionStorage();
                setAdminToken("");
                setProfile(null);
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

    const filteredContents = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return contents.filter((content) => {
            if (typeFilter !== "all" && content.type !== typeFilter) {
                return false;
            }

            if (statusFilter !== "all" && content.status !== statusFilter) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            const searchBlob = [
                content.title,
                content.slug,
                content.summary,
                content.seoTitle,
                content.seoDescription,
                getCategoryName(content.category),
                ...(content.tags || []),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchBlob.includes(normalizedSearch);
        });
    }, [contents, searchTerm, statusFilter, typeFilter]);

    const publishedCount = contents.filter(
        (content) => content.status === "published"
    ).length;

    const draftCount = contents.filter(
        (content) => content.status === "draft"
    ).length;

    if (!isReady) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
                <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold text-slate-600">
                        Loading admin session.
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
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                                Public Content Admin
                            </p>

                            <h1 className="mt-2 text-3xl font-bold">
                                Content Manager
                            </h1>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                List public website content across articles, study notes,
                                notifications, current affairs, vacancies, admit cards,
                                results, syllabus and exam pages.
                            </p>

                            {profile ? (
                                <p className="mt-3 text-xs font-semibold text-slate-500">
                                    Signed in as {profile.name || "Admin"} | {profile.role || "-"} | {profile.tenantId || "-"}
                                </p>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/admin/content/categories"
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Categories
                            </Link>

                            <Link
                                href="/admin/content/create"
                                className="rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                            >
                                New Content
                            </Link>

                            <button
                                type="button"
                                onClick={() => {
                                    if (adminToken) {
                                        void loadContentData(adminToken);
                                    }
                                }}
                                disabled={isLoadingContent}
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isLoadingContent ? "Refreshing." : "Refresh"}
                            </button>

                            <Link
                                href="/admin/dashboard"
                                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Dashboard
                            </Link>
                        </div>
                    </div>
                </header>

                <section className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Content
                        </p>
                        <p className="mt-2 text-3xl font-black">{contents.length}</p>
                    </div>

                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Published
                        </p>
                        <p className="mt-2 text-3xl font-black text-emerald-700">
                            {publishedCount}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Drafts
                        </p>
                        <p className="mt-2 text-3xl font-black text-amber-700">
                            {draftCount}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Categories
                        </p>
                        <p className="mt-2 text-3xl font-black text-blue-700">
                            {categories.length}
                        </p>
                    </div>
                </section>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Search
                            </label>
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Search title, slug, summary, category or tag"
                                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Type
                            </label>
                            <select
                                value={typeFilter}
                                onChange={(event) =>
                                    setTypeFilter(event.target.value as "all" | ContentType)
                                }
                                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            >
                                <option value="all">All types</option>
                                {contentTypeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Status
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value as "all" | ContentStatus)
                                }
                                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            >
                                <option value="all">All statuses</option>
                                <option value="published">Published</option>
                                <option value="draft">Draft</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900 ring-1 ring-blue-100">
                        T-43I Step 1: listing and filters only. Create, edit,
                        publish and category creation controls will be added in the next steps.
                    </div>
                </section>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-xl font-bold">
                                Existing Content
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Showing {filteredContents.length} of {contents.length} content items.
                            </p>
                        </div>
                    </div>

                    {contentError ? (
                        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                            {contentError}
                        </div>
                    ) : null}

                    {isLoadingContent ? (
                        <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                            Loading content.
                        </div>
                    ) : null}

                    {!isLoadingContent && filteredContents.length === 0 ? (
                        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                            <h3 className="text-lg font-bold text-slate-950">
                                No content found
                            </h3>
                            <p className="mt-2 text-sm text-slate-600">
                                No content matches the current filters. The create form will be added in the next step.
                            </p>
                        </div>
                    ) : null}

                    {!isLoadingContent && filteredContents.length > 0 ? (
                        <div className="mt-6 grid gap-4">
                            {filteredContents.map((content) => {
                                const previewHref = getPublicPreviewHref(content);
                                const isPublished = content.status === "published";

                                return (
                                    <article
                                        key={content._id}
                                        className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200"
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                                                        {getContentTypeLabel(content.type)}
                                                    </span>

                                                    <span
                                                        className={
                                                            isPublished
                                                                ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100"
                                                                : "rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-100"
                                                        }
                                                    >
                                                        {isPublished ? "Published" : "Draft"}
                                                    </span>

                                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                                                        {getCategoryName(content.category)}
                                                    </span>
                                                </div>

                                                <h3 className="mt-4 text-lg font-black text-slate-950">
                                                    {content.title || "Untitled content"}
                                                </h3>

                                                <p className="mt-2 break-all text-xs font-semibold text-slate-500">
                                                    /{content.slug || "-"}
                                                </p>

                                                <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                                                    {content.summary ||
                                                        content.seoDescription ||
                                                        "No summary added yet."}
                                                </p>

                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {(content.tags || []).slice(0, 5).map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200"
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex shrink-0 flex-col gap-2 text-sm lg:items-end">
                                                <p className="font-semibold text-slate-500">
                                                    Created: {formatDate(content.createdAt)}
                                                </p>
                                                <p className="font-semibold text-slate-500">
                                                    Published: {formatDate(content.publishedAt)}
                                                </p>

                                                <Link
                                                    href={"/admin/content/" + content._id}
                                                    className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    Edit
                                                </Link>

                                                {isPublished && previewHref ? (
                                                    <Link
                                                        href={previewHref}
                                                        target="_blank"
                                                        className="rounded-2xl bg-blue-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-800"
                                                    >
                                                        Public Preview
                                                    </Link>
                                                ) : (
                                                    <span className="rounded-2xl bg-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-600">
                                                        Preview after publish
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : null}
                </section>
            </div>
        </main>
    );
}

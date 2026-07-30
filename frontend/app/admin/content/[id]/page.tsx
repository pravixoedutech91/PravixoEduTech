"use client";

import Link from "next/link";
import MarkdownContentEditor from "@/components/admin/content/MarkdownContentEditor";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
    _id: string;
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
    content?: string;
    status?: ContentStatus;
    seoTitle?: string;
    seoDescription?: string;
    featuredImage?: string;
    tags?: string[];
    publishedAt?: string;
    createdAt?: string;
    updatedAt?: string;
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

type ContentMutationResponse = {
    success: boolean;
    message?: string;
    data?: ContentItem;
};

type EditContentForm = {
    title: string;
    slug: string;
    type: ContentType;
    category: string;
    status: ContentStatus;
    summary: string;
    content: string;
    tags: string;
    seoTitle: string;
    seoDescription: string;
    featuredImage: string;
};

type ToastState = {
    type: "success" | "error";
    message: string;
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

const createSlugFromTitle = (title: string) => {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
};

const splitTags = (tags: string) => {
    return tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
};

const getCategoryId = (category?: CategorySummary | string | null) => {
    if (!category) {
        return "";
    }

    if (typeof category === "string") {
        return category;
    }

    return category._id || "";
};

const getPublicPreviewHref = (form: EditContentForm) => {
    const basePath = contentTypePathMap.get(form.type);

    if (!basePath || !form.slug) {
        return "";
    }

    return basePath + "/" + form.slug;
};

const initialForm: EditContentForm = {
    title: "",
    slug: "",
    type: "article",
    category: "",
    status: "draft",
    summary: "",
    content: "",
    tags: "",
    seoTitle: "",
    seoDescription: "",
    featuredImage: "",
};

export default function EditAdminContentPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const contentId = params?.id || "";

    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [message, setMessage] = useState("");
    const [adminToken, setAdminToken] = useState("");
    const [profile, setProfile] = useState<AdminProfile | null>(null);

    const [categories, setCategories] = useState<CategorySummary[]>([]);
    const [form, setForm] = useState<EditContentForm>(initialForm);
    const [originalContent, setOriginalContent] = useState<ContentItem | null>(null);
    const [toast, setToast] = useState<ToastState | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedCategoryName = useMemo(() => {
        return (
            categories.find((category) => category._id === form.category)?.name ||
            ""
        );
    }, [categories, form.category]);

    const publicPreviewHref = getPublicPreviewHref(form);

    const loadEditData = async (token: string) => {
        setIsLoadingData(true);

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
                    contentResult.message || "Unable to load content."
                );
            }

            const categoryResult =
                (await categoryResponse.json()) as CategoryListResponse;

            if (!categoryResponse.ok || !categoryResult.success) {
                throw new Error(
                    categoryResult.message || "Unable to load categories."
                );
            }

            const contentItem = (contentResult.data || []).find(
                (item) => item._id === contentId
            );

            if (!contentItem) {
                throw new Error("Content item not found or access denied.");
            }

            const categoryData = Array.isArray(categoryResult.data)
                ? categoryResult.data
                : [];

            setCategories(categoryData);
            setOriginalContent(contentItem);

            setForm({
                title: contentItem.title || "",
                slug: contentItem.slug || "",
                type: contentItem.type || "article",
                category: getCategoryId(contentItem.category),
                status: contentItem.status || "draft",
                summary: contentItem.summary || "",
                content: contentItem.content || "",
                tags: (contentItem.tags || []).join(", "),
                seoTitle: contentItem.seoTitle || "",
                seoDescription: contentItem.seoDescription || "",
                featuredImage: contentItem.featuredImage || "",
            });
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to load content item.",
            });
        } finally {
            setIsLoadingData(false);
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

                await loadEditData(savedToken);
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
    }, [contentId]);

    const updateForm = <Key extends keyof EditContentForm>(
        key: Key,
        value: EditContentForm[Key]
    ) => {
        setForm((currentForm) => ({
            ...currentForm,
            [key]: value,
        }));
    };

    const validateForm = () => {
        if (!form.title.trim()) {
            return "Title is required.";
        }

        if (!form.slug.trim()) {
            return "Slug is required.";
        }

        if (!form.category) {
            return "Category is required.";
        }

        if (!form.summary.trim()) {
            return "Summary is required.";
        }

        if (!form.content.trim()) {
            return "Content body is required.";
        }

        if (form.seoDescription.length > 160) {
            return "SEO description should be 160 characters or less.";
        }

        return "";
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const validationError = validateForm();

        if (validationError) {
            setToast({
                type: "error",
                message: validationError,
            });
            return;
        }

        setIsSubmitting(true);
        setToast(null);

        try {
            const payload = {
                title: form.title.trim(),
                slug: form.slug.trim(),
                type: form.type,
                category: form.category,
                status: form.status,
                summary: form.summary.trim(),
                content: form.content.trim(),
                tags: splitTags(form.tags),
                seoTitle: form.seoTitle.trim(),
                seoDescription: form.seoDescription.trim(),
                featuredImage: form.featuredImage.trim(),
            };

            const response = await fetch(API_BASE_URL + "/api/content/" + contentId, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + adminToken,
                },
                body: JSON.stringify(payload),
            });

            const result = (await response.json()) as ContentMutationResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to update content.");
            }

            setToast({
                type: "success",
                message: "Content updated successfully.",
            });

            setOriginalContent(result.data || originalContent);

            setTimeout(() => {
                router.push("/admin/content");
            }, 700);
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to update content.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

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
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
                <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                                Public Content Admin
                            </p>

                            <h1 className="mt-2 text-3xl font-bold">
                                Edit Content
                            </h1>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Update public content fields and change draft or published status safely.
                            </p>

                            {profile ? (
                                <p className="mt-3 text-xs font-semibold text-slate-500">
                                    Signed in as {profile.name || "Admin"} | {profile.role || "-"} | {profile.tenantId || "-"}
                                </p>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/admin/content"
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Back to Content
                            </Link>

                            {form.status === "published" && publicPreviewHref ? (
                                <Link
                                    href={publicPreviewHref}
                                    target="_blank"
                                    className="rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                                >
                                    Public Preview
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </header>

                {toast ? (
                    <div
                        className={
                            toast.type === "success"
                                ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"
                                : "rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
                        }
                    >
                        {toast.message}
                    </div>
                ) : null}

                {isLoadingData ? (
                    <div className="rounded-3xl bg-white p-6 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
                        Loading content item.
                    </div>
                ) : null}

                {!isLoadingData && originalContent ? (
                    <form
                        onSubmit={handleSubmit}
                        className="grid gap-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                    >
                        <section className="grid gap-5 md:grid-cols-2">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Content Type
                                </label>
                                <select
                                    value={form.type}
                                    onChange={(event) =>
                                        updateForm("type", event.target.value as ContentType)
                                    }
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                >
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
                                    value={form.status}
                                    onChange={(event) =>
                                        updateForm("status", event.target.value as ContentStatus)
                                    }
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Category
                                </label>
                                <select
                                    value={form.category}
                                    onChange={(event) =>
                                        updateForm("category", event.target.value)
                                    }
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                >
                                    {categories.map((category) => (
                                        <option key={category._id} value={category._id}>
                                            {category.name || category.slug || category._id}
                                        </option>
                                    ))}
                                </select>

                                <p className="mt-2 text-xs font-semibold text-slate-500">
                                    Selected category: {selectedCategoryName || "-"}
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Title
                                </label>
                                <input
                                    value={form.title}
                                    onChange={(event) =>
                                        updateForm("title", event.target.value)
                                    }
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Slug
                                </label>
                                <input
                                    value={form.slug}
                                    onChange={(event) =>
                                        updateForm("slug", createSlugFromTitle(event.target.value))
                                    }
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Summary / Quick Answer
                                </label>
                                <textarea
                                    value={form.summary}
                                    onChange={(event) =>
                                        updateForm("summary", event.target.value)
                                    }
                                    rows={4}
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label
                                    htmlFor="content-body"
                                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                >
                                    Content Body
                                </label>

                                <MarkdownContentEditor
                                    id="content-body"
                                    value={form.content}
                                    onChange={(value) => updateForm("content", value)}
                                    placeholder="Write the full public content body. Use the toolbar for headings, lists, tables and official links."
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Tags
                                </label>
                                <input
                                    value={form.tags}
                                    onChange={(event) =>
                                        updateForm("tags", event.target.value)
                                    }
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Featured Image URL
                                </label>
                                <input
                                    value={form.featuredImage}
                                    onChange={(event) =>
                                        updateForm("featuredImage", event.target.value)
                                    }
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            <h2 className="text-lg font-bold">
                                SEO Fields
                            </h2>

                            <div className="mt-5 grid gap-5">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        SEO Title
                                    </label>
                                    <input
                                        value={form.seoTitle}
                                        onChange={(event) =>
                                            updateForm("seoTitle", event.target.value)
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        SEO Description
                                    </label>
                                    <textarea
                                        value={form.seoDescription}
                                        onChange={(event) =>
                                            updateForm("seoDescription", event.target.value)
                                        }
                                        rows={3}
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    />

                                    <p className="mt-2 text-xs font-semibold text-slate-500">
                                        {form.seoDescription.length}/160 characters
                                    </p>
                                </div>
                            </div>
                        </section>

                        <div className="flex flex-col gap-3 rounded-3xl bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-bold text-blue-950">
                                    Update rule
                                </p>
                                <p className="mt-1 text-sm text-blue-900">
                                    Draft content remains hidden. Published content appears publicly after update.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !adminToken}
                                className="rounded-2xl bg-blue-700 px-6 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isSubmitting
                                    ? "Saving."
                                    : form.status === "published"
                                      ? "Save & Publish"
                                      : "Save Draft"}
                            </button>
                        </div>
                    </form>
                ) : null}
            </div>
        </main>
    );
}

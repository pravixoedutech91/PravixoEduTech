"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

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

type CategoryItem = {
    _id: string;
    tenantId?: string;
    name?: string;
    slug?: string;
    description?: string;
    icon?: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
};

type CategoryListResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: CategoryItem[];
};

type CategoryMutationResponse = {
    success: boolean;
    message?: string;
    data?: CategoryItem;
};

type CategoryForm = {
    name: string;
    slug: string;
    description: string;
    icon: string;
    isActive: boolean;
};

type ToastState = {
    type: "success" | "error";
    message: string;
};

const initialForm: CategoryForm = {
    name: "",
    slug: "",
    description: "",
    icon: "",
    isActive: true,
};

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role as typeof ALLOWED_ADMIN_ROLES[number]));
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const createSlugFromName = (name: string) => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
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

export default function AdminContentCategoriesPage() {
    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [message, setMessage] = useState("");
    const [adminToken, setAdminToken] = useState("");
    const [profile, setProfile] = useState<AdminProfile | null>(null);

    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

    const [form, setForm] = useState<CategoryForm>(initialForm);
    const [editingCategoryId, setEditingCategoryId] = useState("");
    const [toast, setToast] = useState<ToastState | null>(null);
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadCategories = async (token: string) => {
        setIsLoadingCategories(true);

        try {
            const response = await fetch(API_BASE_URL + "/api/categories", {
                headers: {
                    Authorization: "Bearer " + token,
                },
            });

            const result = (await response.json()) as CategoryListResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load categories.");
            }

            setCategories(Array.isArray(result.data) ? result.data : []);
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to load categories.",
            });
        } finally {
            setIsLoadingCategories(false);
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

                await loadCategories(savedToken);
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

    useEffect(() => {
        if (!toast) {
            return;
        }

        const toastTimer = window.setTimeout(() => {
            setToast(null);
        }, 3000);

        return () => {
            window.clearTimeout(toastTimer);
        };
    }, [toast]);

    const activeCount = categories.filter((category) => category.isActive).length;
    const inactiveCount = categories.filter((category) => !category.isActive).length;

    const filteredCategories = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return categories.filter((category) => {
            if (statusFilter === "active" && !category.isActive) {
                return false;
            }

            if (statusFilter === "inactive" && category.isActive) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            const searchBlob = [
                category.name,
                category.slug,
                category.description,
                category.icon,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchBlob.includes(normalizedSearch);
        });
    }, [categories, searchTerm, statusFilter]);

    const resetForm = () => {
        setForm(initialForm);
        setEditingCategoryId("");
    };

    const updateForm = <Key extends keyof CategoryForm>(
        key: Key,
        value: CategoryForm[Key]
    ) => {
        setForm((currentForm) => ({
            ...currentForm,
            [key]: value,
        }));
    };

    const handleNameChange = (name: string) => {
        setForm((currentForm) => ({
            ...currentForm,
            name,
            slug:
                currentForm.slug.trim().length > 0
                    ? currentForm.slug
                    : createSlugFromName(name),
        }));
    };

    const startEdit = (category: CategoryItem) => {
        setEditingCategoryId(category._id);
        setForm({
            name: category.name || "",
            slug: category.slug || "",
            description: category.description || "",
            icon: category.icon || "",
            isActive: Boolean(category.isActive),
        });
        setToast(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const validateForm = () => {
        if (!form.name.trim()) {
            return "Category name is required.";
        }

        if (!form.slug.trim()) {
            return "Category slug is required.";
        }

        return "";
    };

    const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
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
                name: form.name.trim(),
                slug: form.slug.trim(),
                description: form.description.trim(),
                icon: form.icon.trim(),
                isActive: form.isActive,
            };

            const url = editingCategoryId
                ? API_BASE_URL + "/api/categories/" + editingCategoryId
                : API_BASE_URL + "/api/categories";

            const method = editingCategoryId ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + adminToken,
                },
                body: JSON.stringify(payload),
            });

            const result = (await response.json()) as CategoryMutationResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to save category.");
            }

            setToast({
                type: "success",
                message: editingCategoryId
                    ? "Category updated successfully."
                    : "Category created successfully.",
            });

            resetForm();

            if (adminToken) {
                await loadCategories(adminToken);
            }
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to save category.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleCategoryStatus = async (category: CategoryItem) => {
        if (!adminToken) {
            return;
        }

        setIsSubmitting(true);
        setToast(null);

        try {
            const response = await fetch(
                API_BASE_URL + "/api/categories/" + category._id,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + adminToken,
                    },
                    body: JSON.stringify({
                        name: category.name || "",
                        slug: category.slug || "",
                        description: category.description || "",
                        icon: category.icon || "",
                        isActive: !category.isActive,
                    }),
                }
            );

            const result = (await response.json()) as CategoryMutationResponse;

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to update category status."
                );
            }

            setToast({
                type: "success",
                message: !category.isActive
                    ? "Category reactivated."
                    : "Category deactivated.",
            });

            await loadCategories(adminToken);
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to update category status.",
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
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                                Public Content Admin
                            </p>

                            <h1 className="mt-2 text-3xl font-bold">
                                Category Manager
                            </h1>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Manage categories used by public website content. Deactivate categories instead of deleting them while content may still reference them.
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

                            <button
                                type="button"
                                onClick={() => {
                                    if (adminToken) {
                                        void loadCategories(adminToken);
                                    }
                                }}
                                disabled={isLoadingCategories}
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isLoadingCategories ? "Refreshing." : "Refresh"}
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

                {toast ? (
                    <div className="fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-sm">
                        <div
                            className={
                                toast.type === "success"
                                    ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-xl"
                                    : "rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800 shadow-xl"
                            }
                        >
                            <div className="flex items-start justify-between gap-4">
                                <p>{toast.message}</p>

                                <button
                                    type="button"
                                    onClick={() => setToast(null)}
                                    className="rounded-full px-2 text-sm font-black leading-none text-slate-500 hover:bg-white/70"
                                    aria-label="Close notification"
                                >
                                    x
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Categories
                        </p>
                        <p className="mt-2 text-3xl font-black">{categories.length}</p>
                    </div>

                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Active
                        </p>
                        <p className="mt-2 text-3xl font-black text-emerald-700">
                            {activeCount}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Inactive
                        </p>
                        <p className="mt-2 text-3xl font-black text-amber-700">
                            {inactiveCount}
                        </p>
                    </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
                    <form
                        onSubmit={saveCategory}
                        className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold">
                                    {editingCategoryId ? "Edit Category" : "Create Category"}
                                </h2>
                                <p className="mt-1 text-sm text-slate-600">
                                    Categories organize public content pages.
                                </p>
                            </div>

                            {editingCategoryId ? (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                            ) : null}
                        </div>

                        <div className="mt-6 grid gap-5">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Name
                                </label>
                                <input
                                    value={form.name}
                                    onChange={(event) =>
                                        handleNameChange(event.target.value)
                                    }
                                    placeholder="Example: Polity"
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
                                        updateForm("slug", createSlugFromName(event.target.value))
                                    }
                                    placeholder="polity"
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Description
                                </label>
                                <textarea
                                    value={form.description}
                                    onChange={(event) =>
                                        updateForm("description", event.target.value)
                                    }
                                    placeholder="Short category description"
                                    rows={4}
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Icon
                                </label>
                                <input
                                    value={form.icon}
                                    onChange={(event) =>
                                        updateForm("icon", event.target.value)
                                    }
                                    placeholder="Optional icon name or emoji"
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>

                            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(event) =>
                                        updateForm("isActive", event.target.checked)
                                    }
                                    className="h-4 w-4"
                                />
                                <span className="text-sm font-bold text-slate-700">
                                    Category active
                                </span>
                            </label>

                            <button
                                type="submit"
                                disabled={isSubmitting || !adminToken}
                                className="rounded-2xl bg-blue-700 px-6 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isSubmitting
                                    ? "Saving."
                                    : editingCategoryId
                                      ? "Update Category"
                                      : "Create Category"}
                            </button>
                        </div>
                    </form>

                    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Search
                                </label>
                                <input
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Search category name, slug or description"
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Status
                                </label>
                                <select
                                    value={statusFilter}
                                    onChange={(event) =>
                                        setStatusFilter(
                                            event.target.value as "all" | "active" | "inactive"
                                        )
                                    }
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                >
                                    <option value="all">All statuses</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900 ring-1 ring-blue-100">
                            Delete is intentionally not included yet. Categories may already be used by content, so deactivate instead of deleting.
                        </div>

                        {isLoadingCategories ? (
                            <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                                Loading categories.
                            </div>
                        ) : null}

                        {!isLoadingCategories && filteredCategories.length === 0 ? (
                            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                                <h3 className="text-lg font-bold text-slate-950">
                                    No categories found
                                </h3>
                                <p className="mt-2 text-sm text-slate-600">
                                    Create a new category or adjust your filters.
                                </p>
                            </div>
                        ) : null}

                        {!isLoadingCategories && filteredCategories.length > 0 ? (
                            <div className="mt-6 grid gap-4">
                                {filteredCategories.map((category) => (
                                    <article
                                        key={category._id}
                                        className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200"
                                    >
                                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap gap-2">
                                                    <span
                                                        className={
                                                            category.isActive
                                                                ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100"
                                                                : "rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-100"
                                                        }
                                                    >
                                                        {category.isActive ? "Active" : "Inactive"}
                                                    </span>

                                                    {category.icon ? (
                                                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                                                            {category.icon}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <h3 className="mt-4 text-lg font-black text-slate-950">
                                                    {category.name || "Untitled category"}
                                                </h3>

                                                <p className="mt-2 break-all text-xs font-semibold text-slate-500">
                                                    /{category.slug || "-"}
                                                </p>

                                                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                                                    {category.description || "No description added yet."}
                                                </p>

                                                <p className="mt-3 text-xs font-semibold text-slate-500">
                                                    Created: {formatDate(category.createdAt)} | Updated: {formatDate(category.updatedAt)}
                                                </p>
                                            </div>

                                            <div className="flex shrink-0 flex-col gap-2 md:items-end">
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(category)}
                                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => void toggleCategoryStatus(category)}
                                                    disabled={isSubmitting}
                                                    className={
                                                        category.isActive
                                                            ? "rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
                                                            : "rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
                                                    }
                                                >
                                                    {category.isActive ? "Deactivate" : "Reactivate"}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : null}
                    </section>
                </section>
            </div>
        </main>
    );
}

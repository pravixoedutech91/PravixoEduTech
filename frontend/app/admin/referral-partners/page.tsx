"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const ADMIN_TOKEN_STORAGE_KEY = "pravixoAdminToken";
const ADMIN_PROFILE_STORAGE_KEY = "pravixoAdminProfile";

const REFERRAL_ADMIN_ROLES = ["super_admin", "tenant_admin"] as const;

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
    data?: AdminProfile;
    message?: string;
};

type ReferralPartnerStatus = "pending" | "active" | "suspended" | "rejected";
type ReferralPartnerFilterStatus = "all" | ReferralPartnerStatus;

type PromoterType =
    | "library"
    | "cyber_cafe"
    | "coaching"
    | "teacher"
    | "student"
    | "influencer"
    | "partner"
    | "other";

type CommissionType = "flat" | "percentage";

type ReferralPartner = {
    _id: string;
    tenantId?: string;
    name?: string;
    mobile?: string;
    email?: string;
    promoterType?: PromoterType;
    code?: string;
    status?: ReferralPartnerStatus;
    commissionType?: CommissionType;
    commissionValue?: number;
    walletBalanceInPaise?: number;
    totalEarnedInPaise?: number;
    totalWithdrawnInPaise?: number;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
};

type ReferralPartnerSummary = {
    total: number;
    pending: number;
    active: number;
    suspended: number;
    rejected: number;
};

type ReferralPartnersResponse = {
    success: boolean;
    count?: number;
    total?: number;
    page?: number;
    pages?: number;
    summary?: ReferralPartnerSummary;
    data?: ReferralPartner[];
    message?: string;
};

type ReferralPartnerMutationResponse = {
    success: boolean;
    data?: ReferralPartner;
    message?: string;
};

type ToastState = {
    type: "success" | "error";
    message: string;
};

type PartnerForm = {
    name: string;
    mobile: string;
    email: string;
    promoterType: PromoterType;
    code: string;
    status: ReferralPartnerStatus;
    commissionType: CommissionType;
    commissionValue: string;
    notes: string;
};

const defaultSummary: ReferralPartnerSummary = {
    total: 0,
    pending: 0,
    active: 0,
    suspended: 0,
    rejected: 0,
};

const initialForm: PartnerForm = {
    name: "",
    mobile: "",
    email: "",
    promoterType: "partner",
    code: "",
    status: "pending",
    commissionType: "flat",
    commissionValue: "0",
    notes: "",
};

const promoterTypeOptions: { value: PromoterType; label: string }[] = [
    { value: "library", label: "Library" },
    { value: "cyber_cafe", label: "Cyber Cafe" },
    { value: "coaching", label: "Coaching" },
    { value: "teacher", label: "Teacher" },
    { value: "student", label: "Student" },
    { value: "influencer", label: "Influencer" },
    { value: "partner", label: "Partner" },
    { value: "other", label: "Other" },
];

const statusFilterOptions: { value: ReferralPartnerFilterStatus; label: string }[] = [
    { value: "all", label: "All partners" },
    { value: "pending", label: "Pending" },
    { value: "active", label: "Active" },
    { value: "suspended", label: "Suspended" },
    { value: "rejected", label: "Rejected" },
];

const isReferralAdminRole = (role?: string) => {
    return Boolean(role && REFERRAL_ADMIN_ROLES.includes(role as typeof REFERRAL_ADMIN_ROLES[number]));
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const normalizeMobile = (value: string) => {
    return value.replace(/\D/g, "").slice(0, 10);
};

const normalizeCode = (value: string) => {
    return value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "")
        .slice(0, 40);
};

const formatRupees = (amountInPaise?: number) => {
    const amount = Number(amountInPaise || 0) / 100;

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(amount);
};

const formatDateTime = (value?: string) => {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getStatusBadgeClass = (status?: string) => {
    switch (status) {
        case "active":
            return "bg-emerald-50 text-emerald-700 ring-emerald-100";
        case "pending":
            return "bg-amber-50 text-amber-700 ring-amber-100";
        case "suspended":
            return "bg-red-50 text-red-700 ring-red-100";
        case "rejected":
            return "bg-slate-100 text-slate-700 ring-slate-200";
        default:
            return "bg-slate-100 text-slate-500 ring-slate-200";
    }
};

const getPromoterTypeLabel = (value?: string) => {
    return promoterTypeOptions.find((option) => option.value === value)?.label || "Other";
};

const buildCreatePayload = (form: PartnerForm, tenantId?: string) => {
    return {
        tenantId,
        name: form.name.trim(),
        mobile: normalizeMobile(form.mobile),
        email: form.email.trim().toLowerCase(),
        promoterType: form.promoterType,
        code: normalizeCode(form.code),
        status: form.status,
        commissionType: form.commissionType,
        commissionValue: Number(form.commissionValue || 0),
        notes: form.notes.trim(),
    };
};

export default function AdminReferralPartnersPage() {
    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [adminToken, setAdminToken] = useState("");
    const [profile, setProfile] = useState<AdminProfile | null>(null);
    const [message, setMessage] = useState("Checking admin session...");

    const [partners, setPartners] = useState<ReferralPartner[]>([]);
    const [summary, setSummary] = useState<ReferralPartnerSummary>(defaultSummary);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<ToastState | null>(null);

    const [statusFilter, setStatusFilter] = useState<ReferralPartnerFilterStatus>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [form, setForm] = useState<PartnerForm>(initialForm);
    const [editingPartnerId, setEditingPartnerId] = useState("");
    const [editForm, setEditForm] = useState<PartnerForm>(initialForm);

    const activePartnerCount = useMemo(() => {
        return partners.filter((partner) => partner.status === "active").length;
    }, [partners]);

    useEffect(() => {
        if (!toast) {
            return;
        }

        const timerId = window.setTimeout(() => {
            setToast(null);
        }, 5000);

        return () => window.clearTimeout(timerId);
    }, [toast]);

    const loadPartners = async (
        token: string,
        options: {
            nextStatusFilter?: ReferralPartnerFilterStatus;
            nextSearchQuery?: string;
            clearToast?: boolean;
        } = {}
    ) => {
        setIsLoading(true);

        if (options.clearToast !== false) {
            setToast(null);
        }

        try {
            const params = new URLSearchParams();
            params.set("limit", "100");

            const selectedStatus = options.nextStatusFilter || statusFilter;
            const selectedSearch = options.nextSearchQuery ?? searchQuery;

            if (selectedStatus !== "all") {
                params.set("status", selectedStatus);
            }

            if (selectedSearch.trim()) {
                params.set("q", selectedSearch.trim());
            }

            const response = await fetch(
                API_BASE_URL + "/api/referral-partners?" + params.toString(),
                {
                    headers: {
                        Authorization: "Bearer " + token,
                    },
                }
            );

            const result = (await response.json()) as ReferralPartnersResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load referral partners.");
            }

            setPartners(Array.isArray(result.data) ? result.data : []);
            setSummary(result.summary || defaultSummary);
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to load referral partners.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            const verifyAdminSession = async () => {
                const savedToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

                if (!savedToken) {
                    clearAdminSessionStorage();
                    setIsReady(true);
                    setIsAllowed(false);
                    setMessage("Please login with an admin account.");
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
                        throw new Error(result.message || "Your admin session has expired.");
                    }

                    if (!isReferralAdminRole(result.data.role)) {
                        throw new Error("Only Super Admin and Admin can manage referrals.");
                    }

                    window.localStorage.setItem(
                        ADMIN_PROFILE_STORAGE_KEY,
                        JSON.stringify(result.data)
                    );

                    setAdminToken(savedToken);
                    setProfile(result.data);
                    setIsAllowed(true);
                    setMessage("");

                    await loadPartners(savedToken, { clearToast: false });
                } catch (error) {
                    clearAdminSessionStorage();
                    setAdminToken("");
                    setProfile(null);
                    setIsAllowed(false);
                    setMessage(
                        error instanceof Error
                            ? error.message
                            : "Please login with an admin account."
                    );
                } finally {
                    setIsReady(true);
                }
            };

            void verifyAdminSession();
        }, 0);

        return () => window.clearTimeout(timerId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!adminToken || !profile) {
            setToast({ type: "error", message: "Admin session not found." });
            return;
        }

        if (!form.name.trim()) {
            setToast({ type: "error", message: "Partner name is required." });
            return;
        }

        if (normalizeMobile(form.mobile).length !== 10) {
            setToast({ type: "error", message: "Valid 10 digit mobile is required." });
            return;
        }

        if (normalizeCode(form.code).length < 4) {
            setToast({ type: "error", message: "Referral code must be at least 4 characters." });
            return;
        }

        setIsSubmitting(true);
        setToast(null);

        try {
            const response = await fetch(API_BASE_URL + "/api/referral-partners", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + adminToken,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(buildCreatePayload(form, profile.tenantId)),
            });

            const result = (await response.json()) as ReferralPartnerMutationResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to create referral partner.");
            }

            setForm(initialForm);
            setToast({
                type: "success",
                message: result.message || "Referral partner created successfully.",
            });

            await loadPartners(adminToken, { clearToast: false });
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to create referral partner.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const startEditing = (partner: ReferralPartner) => {
        setEditingPartnerId(partner._id);
        setEditForm({
            name: partner.name || "",
            mobile: partner.mobile || "",
            email: partner.email || "",
            promoterType: partner.promoterType || "other",
            code: partner.code || "",
            status: partner.status || "pending",
            commissionType: partner.commissionType || "flat",
            commissionValue: String(partner.commissionValue ?? 0),
            notes: partner.notes || "",
        });
    };

    const cancelEditing = () => {
        setEditingPartnerId("");
        setEditForm(initialForm);
    };

    const handleUpdateSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!adminToken || !profile || !editingPartnerId) {
            setToast({ type: "error", message: "Admin session or partner not found." });
            return;
        }

        setIsSubmitting(true);
        setToast(null);

        try {
            const response = await fetch(
                API_BASE_URL + "/api/referral-partners/" + editingPartnerId,
                {
                    method: "PUT",
                    headers: {
                        Authorization: "Bearer " + adminToken,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(buildCreatePayload(editForm, profile.tenantId)),
                }
            );

            const result = (await response.json()) as ReferralPartnerMutationResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to update referral partner.");
            }

            cancelEditing();
            setToast({
                type: "success",
                message: result.message || "Referral partner updated successfully.",
            });

            await loadPartners(adminToken, { clearToast: false });
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to update referral partner.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const updatePartnerStatus = async (
        partner: ReferralPartner,
        action: "activate" | "suspend" | "reject"
    ) => {
        if (!adminToken || !profile) {
            setToast({ type: "error", message: "Admin session not found." });
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to ${action} referral partner ${partner.name || partner.code}?`
        );

        if (!confirmed) {
            return;
        }

        setIsSubmitting(true);
        setToast(null);

        try {
            const response = await fetch(
                API_BASE_URL + "/api/referral-partners/" + partner._id + "/" + action,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: "Bearer " + adminToken,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        tenantId: profile.tenantId,
                    }),
                }
            );

            const result = (await response.json()) as ReferralPartnerMutationResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to update referral partner status.");
            }

            setToast({
                type: "success",
                message: result.message || "Referral partner status updated.",
            });

            await loadPartners(adminToken, { clearToast: false });
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to update referral partner status.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusFilterChange = async (event: ChangeEvent<HTMLSelectElement>) => {
        const nextStatus = event.target.value as ReferralPartnerFilterStatus;
        setStatusFilter(nextStatus);

        if (adminToken) {
            await loadPartners(adminToken, { nextStatusFilter: nextStatus });
        }
    };

    const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (adminToken) {
            await loadPartners(adminToken, { nextSearchQuery: searchQuery });
        }
    };

    if (!isReady) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
                <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    Checking admin session...
                </div>
            </main>
        );
    }

    if (!isAllowed || !adminToken || !profile) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
                <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                        Referral Admin Access
                    </p>

                    <h1 className="mt-3 text-2xl font-bold">Login required</h1>

                    <p className="mt-3 text-sm text-slate-600">
                        {message || "Please login with an authorized admin account."}
                    </p>

                    <Link
                        href="/admin/login"
                        className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                        Go to Admin Login
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
            <div className="mx-auto max-w-7xl space-y-6">
                <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
                            Referral MVP
                        </p>
                        <h1 className="mt-2 text-3xl font-black">Referral Partners</h1>
                        <p className="mt-2 max-w-3xl text-sm text-slate-600">
                            Create and review referral promoters. Commission is only tracked for future
                            paid purchase conversion and remains admin controlled.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/admin/dashboard"
                            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Dashboard
                        </Link>
                        <button
                            type="button"
                            onClick={() => void loadPartners(adminToken)}
                            disabled={isLoading}
                            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            {isLoading ? "Refreshing..." : "Refresh"}
                        </button>
                    </div>
                </div>

                {toast ? (
                    <div
                        className={
                            "flex items-start justify-between gap-4 rounded-3xl p-4 text-sm font-semibold ring-1 " +
                            (toast.type === "success"
                                ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                                : "bg-red-50 text-red-800 ring-red-100")
                        }
                    >
                        <span>{toast.message}</span>
                        <button
                            type="button"
                            onClick={() => setToast(null)}
                            className="text-xs uppercase tracking-[0.2em] opacity-70 hover:opacity-100"
                        >
                            Close
                        </button>
                    </div>
                ) : null}

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Total
                        </p>
                        <p className="mt-2 text-3xl font-black">{summary.total}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Active
                        </p>
                        <p className="mt-2 text-3xl font-black text-emerald-700">
                            {summary.active || activePartnerCount}
                        </p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Pending
                        </p>
                        <p className="mt-2 text-3xl font-black text-amber-700">{summary.pending}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Suspended
                        </p>
                        <p className="mt-2 text-3xl font-black text-red-700">{summary.suspended}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Rejected
                        </p>
                        <p className="mt-2 text-3xl font-black text-slate-700">{summary.rejected}</p>
                    </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
                    <form
                        onSubmit={handleCreateSubmit}
                        className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                    >
                        <h2 className="text-xl font-black">Create Referral Partner</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Keep partner status pending until admin verification is complete.
                        </p>

                        <div className="mt-5 space-y-4">
                            <label className="block">
                                <span className="text-sm font-semibold text-slate-700">Partner name</span>
                                <input
                                    value={form.name}
                                    onChange={(event) =>
                                        setForm((current) => ({ ...current, name: event.target.value }))
                                    }
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    placeholder="Example: ABC Library"
                                />
                            </label>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Mobile</span>
                                    <input
                                        value={form.mobile}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                mobile: normalizeMobile(event.target.value),
                                            }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="10 digit mobile"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Email</span>
                                    <input
                                        value={form.email}
                                        onChange={(event) =>
                                            setForm((current) => ({ ...current, email: event.target.value }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="Optional email"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Promoter type</span>
                                    <select
                                        value={form.promoterType}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                promoterType: event.target.value as PromoterType,
                                            }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    >
                                        {promoterTypeOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Referral code</span>
                                    <input
                                        value={form.code}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                code: normalizeCode(event.target.value),
                                            }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] outline-none focus:border-blue-500"
                                        placeholder="ABC123"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Commission type</span>
                                    <select
                                        value={form.commissionType}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                commissionType: event.target.value as CommissionType,
                                            }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    >
                                        <option value="flat">Flat paise amount</option>
                                        <option value="percentage">Percentage</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Commission value</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.commissionValue}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                commissionValue: event.target.value,
                                            }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="2500 means ?25 for flat"
                                    />
                                </label>
                            </div>

                            <label className="block">
                                <span className="text-sm font-semibold text-slate-700">Initial status</span>
                                <select
                                    value={form.status}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            status: event.target.value as ReferralPartnerStatus,
                                        }))
                                    }
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-sm font-semibold text-slate-700">Notes</span>
                                <textarea
                                    value={form.notes}
                                    onChange={(event) =>
                                        setForm((current) => ({ ...current, notes: event.target.value }))
                                    }
                                    rows={3}
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    placeholder="Optional admin note"
                                />
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="mt-5 w-full rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            {isSubmitting ? "Saving..." : "Create Partner"}
                        </button>
                    </form>

                    <section className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                            <div>
                                <h2 className="text-xl font-black">Partner Ledger</h2>
                                <p className="mt-2 text-sm text-slate-600">
                                    Search, edit, activate, suspend, or reject referral partners.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <form onSubmit={handleSearch} className="flex gap-2">
                                    <input
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        placeholder="Search name, mobile, email, code"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
                                    >
                                        Search
                                    </button>
                                </form>

                                <select
                                    value={statusFilter}
                                    onChange={handleStatusFilterChange}
                                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                >
                                    {statusFilterOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-3xl border border-slate-200">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">Partner</th>
                                            <th className="px-4 py-3">Code</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Commission</th>
                                            <th className="px-4 py-3">Wallet</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Created</th>
                                            <th className="px-4 py-3">Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                                    Loading referral partners...
                                                </td>
                                            </tr>
                                        ) : partners.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                                    No referral partners found.
                                                </td>
                                            </tr>
                                        ) : (
                                            partners.map((partner) => (
                                                <tr key={partner._id} className="align-top">
                                                    <td className="px-4 py-4">
                                                        <div className="font-semibold text-slate-900">
                                                            {partner.name || "-"}
                                                        </div>
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            {partner.mobile || "-"} · {partner.email || "No email"}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black tracking-[0.18em] text-slate-700">
                                                            {partner.code || "-"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {getPromoterTypeLabel(partner.promoterType)}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {partner.commissionType === "percentage"
                                                            ? `${partner.commissionValue || 0}%`
                                                            : formatRupees(partner.commissionValue || 0)}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div>{formatRupees(partner.walletBalanceInPaise)}</div>
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            Earned {formatRupees(partner.totalEarnedInPaise)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span
                                                            className={
                                                                "inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 " +
                                                                getStatusBadgeClass(partner.status)
                                                            }
                                                        >
                                                            {partner.status || "unknown"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {formatDateTime(partner.createdAt)}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex min-w-52 flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => startEditing(partner)}
                                                                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void updatePartnerStatus(partner, "activate")}
                                                                disabled={isSubmitting || partner.status === "active"}
                                                                className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                                            >
                                                                Activate
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void updatePartnerStatus(partner, "suspend")}
                                                                disabled={isSubmitting || partner.status === "suspended"}
                                                                className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                                            >
                                                                Suspend
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void updatePartnerStatus(partner, "reject")}
                                                                disabled={isSubmitting || partner.status === "rejected"}
                                                                className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </section>

                {editingPartnerId ? (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-4 py-8">
                        <form
                            onSubmit={handleUpdateSubmit}
                            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
                                        Edit Partner
                                    </p>
                                    <h2 className="mt-2 text-2xl font-black">Update Referral Partner</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={cancelEditing}
                                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Name</span>
                                    <input
                                        value={editForm.name}
                                        onChange={(event) =>
                                            setEditForm((current) => ({ ...current, name: event.target.value }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Mobile</span>
                                    <input
                                        value={editForm.mobile}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                mobile: normalizeMobile(event.target.value),
                                            }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Email</span>
                                    <input
                                        value={editForm.email}
                                        onChange={(event) =>
                                            setEditForm((current) => ({ ...current, email: event.target.value }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Code</span>
                                    <input
                                        value={editForm.code}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                code: normalizeCode(event.target.value),
                                            }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Promoter type</span>
                                    <select
                                        value={editForm.promoterType}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                promoterType: event.target.value as PromoterType,
                                            }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    >
                                        {promoterTypeOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Status</span>
                                    <select
                                        value={editForm.status}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                status: event.target.value as ReferralPartnerStatus,
                                            }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="active">Active</option>
                                        <option value="suspended">Suspended</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Commission type</span>
                                    <select
                                        value={editForm.commissionType}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                commissionType: event.target.value as CommissionType,
                                            }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    >
                                        <option value="flat">Flat paise amount</option>
                                        <option value="percentage">Percentage</option>
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Commission value</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.commissionValue}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                commissionValue: event.target.value,
                                            }))
                                        }
                                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />
                                </label>
                            </div>

                            <label className="mt-4 block">
                                <span className="text-sm font-semibold text-slate-700">Notes</span>
                                <textarea
                                    value={editForm.notes}
                                    onChange={(event) =>
                                        setEditForm((current) => ({ ...current, notes: event.target.value }))
                                    }
                                    rows={3}
                                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                />
                            </label>

                            <div className="mt-5 flex flex-wrap justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={cancelEditing}
                                    className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                    {isSubmitting ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : null}
            </div>
        </main>
    );
}


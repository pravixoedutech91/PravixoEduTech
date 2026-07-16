"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const ADMIN_TOKEN_STORAGE_KEY = "pravixoAdminToken";
const ADMIN_PROFILE_STORAGE_KEY = "pravixoAdminProfile";

const BILLING_ADMIN_ROLES = ["super_admin", "tenant_admin"] as const;

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

type PaymentStatus = "all" | "created" | "paid" | "failed" | "cancelled" | "refunded";

type PaymentLedgerStudent = {
    _id?: string;
    name?: string;
    email?: string;
    mobile?: string;
    tenantId?: string;
} | null;

type PaymentLedgerProduct = {
    _id?: string | null;
    title?: string;
    slug?: string;
    productType?: string;
    priceInPaise?: number | null;
    currency?: "INR" | string;
    tenantId?: string | null;
} | null;

type PaymentLedgerEntitlement = {
    _id?: string;
    status?: string;
    entitlementType?: string;
    mockTestIds?: string[];
    validFrom?: string;
    validUntil?: string;
    revokedAt?: string;
    revokedReason?: string;
    createdAt?: string;
} | null;

type PaymentLedgerPurchase = {
    _id: string;
    tenantId: string;
    studentId: string;
    productId: string;
    student: PaymentLedgerStudent;
    product: PaymentLedgerProduct;
    productSnapshot?: {
        title?: string;
        slug?: string;
        productType?: string;
        includedMockTestIds?: string[];
        validityDays?: number;
    };
    amountInPaise: number;
    priceInRupees: number;
    currency: "INR" | string;
    status: string;
    provider: string;
    receipt?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    paidAt?: string;
    failedAt?: string;
    cancelledAt?: string;
    refundedAt?: string;
    failureReason?: string;
    entitlement: PaymentLedgerEntitlement;
    createdAt?: string;
    updatedAt?: string;
};

type PaymentLedgerSummaryBucket = {
    count: number;
    amountInPaise: number;
};

type PaymentLedgerSummary = {
    total: PaymentLedgerSummaryBucket;
    created: PaymentLedgerSummaryBucket;
    paid: PaymentLedgerSummaryBucket;
    failed: PaymentLedgerSummaryBucket;
    cancelled: PaymentLedgerSummaryBucket;
    refunded: PaymentLedgerSummaryBucket;
};

type PaymentLedgerResponse = {
    success: boolean;
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summary: PaymentLedgerSummary;
    data: PaymentLedgerPurchase[];
    message?: string;
};

const defaultSummary: PaymentLedgerSummary = {
    total: { count: 0, amountInPaise: 0 },
    created: { count: 0, amountInPaise: 0 },
    paid: { count: 0, amountInPaise: 0 },
    failed: { count: 0, amountInPaise: 0 },
    cancelled: { count: 0, amountInPaise: 0 },
    refunded: { count: 0, amountInPaise: 0 },
};

const statusFilters: { value: PaymentStatus; label: string }[] = [
    { value: "all", label: "All purchases" },
    { value: "paid", label: "Paid" },
    { value: "created", label: "Created / Pending" },
    { value: "failed", label: "Failed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "refunded", label: "Refunded" },
];

const isBillingAdminRole = (role?: string) => {
    return Boolean(role && BILLING_ADMIN_ROLES.includes(role as typeof BILLING_ADMIN_ROLES[number]));
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const formatRupees = (amountInPaise?: number) => {
    const amount = Number(amountInPaise || 0) / 100;

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(amount);
};

const formatDateTime = (value?: string | null) => {
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

const shortId = (value?: string | null) => {
    if (!value) {
        return "-";
    }

    return value.length > 12 ? "..." + value.slice(-10) : value;
};

const getStatusBadgeClass = (status?: string) => {
    switch (status) {
        case "paid":
            return "bg-emerald-50 text-emerald-700 ring-emerald-100";
        case "created":
            return "bg-amber-50 text-amber-700 ring-amber-100";
        case "failed":
            return "bg-red-50 text-red-700 ring-red-100";
        case "cancelled":
            return "bg-slate-100 text-slate-700 ring-slate-200";
        case "refunded":
            return "bg-blue-50 text-blue-700 ring-blue-100";
        default:
            return "bg-slate-100 text-slate-700 ring-slate-200";
    }
};

const getEntitlementBadgeClass = (status?: string) => {
    switch (status) {
        case "active":
            return "bg-emerald-50 text-emerald-700 ring-emerald-100";
        case "expired":
            return "bg-slate-100 text-slate-700 ring-slate-200";
        case "revoked":
            return "bg-red-50 text-red-700 ring-red-100";
        default:
            return "bg-slate-100 text-slate-500 ring-slate-200";
    }
};

export default function AdminPaymentPurchasesPage() {
    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [adminToken, setAdminToken] = useState("");
    const [profile, setProfile] = useState<AdminProfile | null>(null);
    const [message, setMessage] = useState("Checking admin session...");
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<PaymentStatus>("all");
    const [purchases, setPurchases] = useState<PaymentLedgerPurchase[]>([]);
    const [summary, setSummary] = useState<PaymentLedgerSummary>(defaultSummary);

    const paidRevenueLabel = useMemo(() => {
        return formatRupees(summary.paid.amountInPaise);
    }, [summary.paid.amountInPaise]);

    const selectedFilterLabel =
        statusFilters.find((filter) => filter.value === statusFilter)?.label || "All purchases";

    const loadLedger = async (token: string, nextStatusFilter: PaymentStatus) => {
        setIsLoading(true);
        setErrorMessage("");

        try {
            const params = new URLSearchParams();
            params.set("limit", "50");

            if (nextStatusFilter !== "all") {
                params.set("status", nextStatusFilter);
            }

            const response = await fetch(
                API_BASE_URL + "/api/payment-products/purchases?" + params.toString(),
                {
                    headers: {
                        Authorization: "Bearer " + token,
                    },
                }
            );

            const result = (await response.json()) as PaymentLedgerResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to load payment ledger.");
            }

            setPurchases(Array.isArray(result.data) ? result.data : []);
            setSummary(result.summary || defaultSummary);
        } catch (error) {
            setPurchases([]);
            setSummary(defaultSummary);
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to load payment ledger."
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const verifyAdminSession = async () => {
            const savedToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

            if (!savedToken) {
                clearAdminSessionStorage();
                setMessage("Please login with an admin account.");
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
                    throw new Error(result.message || "Admin session is invalid.");
                }

                if (!isBillingAdminRole(result.data.role)) {
                    setProfile(result.data);
                    setAdminToken(savedToken);
                    setIsAllowed(false);
                    setMessage("Payment ledger can be viewed only by Admin or Super Admin.");
                    return;
                }

                setProfile(result.data);
                setAdminToken(savedToken);
                setIsAllowed(true);
                setMessage("");
                await loadLedger(savedToken, "all");
            } catch (error) {
                clearAdminSessionStorage();
                setAdminToken("");
                setProfile(null);
                setIsAllowed(false);
                setMessage(
                    error instanceof Error ? error.message : "Admin session is invalid."
                );
            } finally {
                setIsReady(true);
            }
        };

        void verifyAdminSession();
    }, []);

    const handleStatusFilterChange = async (event: ChangeEvent<HTMLSelectElement>) => {
        const nextStatusFilter = event.target.value as PaymentStatus;

        setStatusFilter(nextStatusFilter);

        if (adminToken) {
            await loadLedger(adminToken, nextStatusFilter);
        }
    };

    const handleRefresh = async () => {
        if (!adminToken) {
            return;
        }

        await loadLedger(adminToken, statusFilter);
    };

    if (!isReady) {
        return (
            <main className="min-h-screen bg-slate-100 p-6">
                <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm">
                    <p className="text-sm font-semibold text-slate-600">Checking admin session...</p>
                </div>
            </main>
        );
    }

    if (!isAllowed) {
        return (
            <main className="min-h-screen bg-slate-100 p-6">
                <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
                    <p className="text-sm font-semibold text-red-600">{message}</p>
                    <div className="mt-6 flex gap-3">
                        <Link
                            href="/admin/login"
                            className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white"
                        >
                            Go to Admin Login
                        </Link>
                        <Link
                            href="/admin/dashboard"
                            className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700"
                        >
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
            <div className="mx-auto max-w-7xl space-y-6">
                <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-200">
                                Payments
                            </p>
                            <h1 className="mt-3 text-3xl font-black">Payment Ledger</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                                View Razorpay orders, paid purchases, student details, and entitlement validity.
                            </p>
                            <p className="mt-3 text-xs text-slate-400">
                                Logged in as {profile?.name || "Admin"} ({profile?.role || "admin"})
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/admin/payment-packages"
                                className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950"
                            >
                                Payment Packages
                            </Link>
                            <Link
                                href="/admin/dashboard"
                                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-bold text-white"
                            >
                                Dashboard
                            </Link>
                        </div>
                    </div>
                </header>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-sm font-bold text-slate-500">Total Orders</p>
                        <p className="mt-2 text-3xl font-black">{summary.total.count}</p>
                        <p className="mt-1 text-xs text-slate-500">
                            {formatRupees(summary.total.amountInPaise)}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-emerald-50 p-5 shadow-sm ring-1 ring-emerald-100">
                        <p className="text-sm font-bold text-emerald-700">Paid Revenue</p>
                        <p className="mt-2 text-3xl font-black text-emerald-950">{paidRevenueLabel}</p>
                        <p className="mt-1 text-xs text-emerald-700">{summary.paid.count} paid order(s)</p>
                    </div>

                    <div className="rounded-3xl bg-amber-50 p-5 shadow-sm ring-1 ring-amber-100">
                        <p className="text-sm font-bold text-amber-700">Created / Pending</p>
                        <p className="mt-2 text-3xl font-black text-amber-950">{summary.created.count}</p>
                        <p className="mt-1 text-xs text-amber-700">
                            {formatRupees(summary.created.amountInPaise)}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-red-50 p-5 shadow-sm ring-1 ring-red-100">
                        <p className="text-sm font-bold text-red-700">Failed / Cancelled</p>
                        <p className="mt-2 text-3xl font-black text-red-950">
                            {summary.failed.count + summary.cancelled.count}
                        </p>
                        <p className="mt-1 text-xs text-red-700">
                            {formatRupees(summary.failed.amountInPaise + summary.cancelled.amountInPaise)}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-blue-50 p-5 shadow-sm ring-1 ring-blue-100">
                        <p className="text-sm font-bold text-blue-700">Refunded</p>
                        <p className="mt-2 text-3xl font-black text-blue-950">{summary.refunded.count}</p>
                        <p className="mt-1 text-xs text-blue-700">
                            {formatRupees(summary.refunded.amountInPaise)}
                        </p>
                    </div>
                </section>

                <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-xl font-black">Purchase Records</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Showing {selectedFilterLabel.toLowerCase()}.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <select
                                value={statusFilter}
                                onChange={(event) => void handleStatusFilterChange(event)}
                                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold"
                            >
                                {statusFilters.map((filter) => (
                                    <option key={filter.value} value={filter.value}>
                                        {filter.label}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                onClick={() => void handleRefresh()}
                                disabled={isLoading}
                                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-400"
                            >
                                {isLoading ? "Refreshing..." : "Refresh"}
                            </button>
                        </div>
                    </div>

                    {errorMessage ? (
                        <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                            {errorMessage}
                        </div>
                    ) : null}

                    <div className="mt-5 overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
                            <thead>
                                <tr className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                    <th className="px-4 py-2">Created</th>
                                    <th className="px-4 py-2">Student</th>
                                    <th className="px-4 py-2">Product</th>
                                    <th className="px-4 py-2">Status</th>
                                    <th className="px-4 py-2">Amount</th>
                                    <th className="px-4 py-2">Razorpay</th>
                                    <th className="px-4 py-2">Entitlement</th>
                                    <th className="px-4 py-2">Valid Until</th>
                                </tr>
                            </thead>

                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={8} className="rounded-2xl bg-slate-50 p-6 text-center font-semibold text-slate-500">
                                            Loading payment ledger...
                                        </td>
                                    </tr>
                                ) : purchases.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="rounded-2xl bg-slate-50 p-6 text-center font-semibold text-slate-500">
                                            No payment records found for this filter.
                                        </td>
                                    </tr>
                                ) : (
                                    purchases.map((purchase) => (
                                        <tr key={purchase._id} className="bg-slate-50 align-top">
                                            <td className="rounded-l-2xl px-4 py-4">
                                                <p className="font-bold text-slate-800">
                                                    {formatDateTime(purchase.createdAt)}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {shortId(purchase._id)}
                                                </p>
                                            </td>

                                            <td className="px-4 py-4">
                                                <p className="font-bold text-slate-900">
                                                    {purchase.student?.name || "Unknown student"}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {purchase.student?.mobile || "-"}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {purchase.student?.email || "-"}
                                                </p>
                                            </td>

                                            <td className="px-4 py-4">
                                                <p className="font-bold text-slate-900">
                                                    {purchase.product?.title ||
                                                        purchase.productSnapshot?.title ||
                                                        "Unknown product"}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {purchase.product?.slug || purchase.productSnapshot?.slug || "-"}
                                                </p>
                                            </td>

                                            <td className="px-4 py-4">
                                                <span
                                                    className={
                                                        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 " +
                                                        getStatusBadgeClass(purchase.status)
                                                    }
                                                >
                                                    {purchase.status}
                                                </span>
                                                {purchase.paidAt ? (
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        Paid: {formatDateTime(purchase.paidAt)}
                                                    </p>
                                                ) : null}
                                            </td>

                                            <td className="px-4 py-4">
                                                <p className="font-black text-slate-900">
                                                    {formatRupees(purchase.amountInPaise)}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">{purchase.currency}</p>
                                            </td>

                                            <td className="px-4 py-4">
                                                <p className="text-xs font-semibold text-slate-600">
                                                    Order: {shortId(purchase.razorpayOrderId)}
                                                </p>
                                                <p className="mt-1 text-xs font-semibold text-slate-600">
                                                    Payment: {shortId(purchase.razorpayPaymentId)}
                                                </p>
                                            </td>

                                            <td className="px-4 py-4">
                                                <span
                                                    className={
                                                        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 " +
                                                        getEntitlementBadgeClass(purchase.entitlement?.status)
                                                    }
                                                >
                                                    {purchase.entitlement?.status || "not created"}
                                                </span>
                                                <p className="mt-2 text-xs text-slate-500">
                                                    Tests: {purchase.entitlement?.mockTestIds?.length || 0}
                                                </p>
                                            </td>

                                            <td className="rounded-r-2xl px-4 py-4">
                                                <p className="font-semibold text-slate-800">
                                                    {formatDateTime(purchase.entitlement?.validUntil)}
                                                </p>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    );
}

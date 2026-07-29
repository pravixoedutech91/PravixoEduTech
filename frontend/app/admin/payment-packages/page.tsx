"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
    message?: string;
    data?: AdminProfile;
};

type MockTestSummary = {
    _id: string;
    title?: string;
    slug?: string;
    accessType?: "free" | "paid" | "assigned";
    isPublished?: boolean;
    isActive?: boolean;
};

type MockTestsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: MockTestSummary[];
};

type PaymentProduct = {
    _id: string;
    tenantId?: string;
    title?: string;
    slug?: string;
    description?: string;
    productType?: "mock_test_pack";
    priceInPaise?: number;
    currency?: "INR";
    includedMockTestIds?: Array<MockTestSummary | string>;
    validityDays?: number;
    isActive?: boolean;
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
};

type PaymentProductsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    total?: number;
    data?: PaymentProduct[];
};

type PaymentProductMutationResponse = {
    success: boolean;
    message?: string;
    data?: PaymentProduct;
};

type ToastState = {
    type: "success" | "error";
    message: string;
};

type CreatePackForm = {
    title: string;
    slug: string;
    description: string;
    priceInRupees: string;
    validityDays: string;
    selectedMockTestIds: string[];
    sortOrder: string;
};

const initialCreatePackForm: CreatePackForm = {
    title: "",
    slug: "",
    description: "",
    priceInRupees: "99",
    validityDays: "30",
    selectedMockTestIds: [],
    sortOrder: "100",
};

const isBillingAdminRole = (role?: string) => {
    return Boolean(role && BILLING_ADMIN_ROLES.includes(role as typeof BILLING_ADMIN_ROLES[number]));
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const hasText = (value: string) => {
    return value.trim().length > 0;
};

const createSlugFromText = (value: string) => {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
};

const formatPrice = (priceInPaise?: number) => {
    const rupees = Number(priceInPaise || 0) / 100;

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(rupees);
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

const getIncludedTestCount = (product: PaymentProduct) => {
    return Array.isArray(product.includedMockTestIds)
        ? product.includedMockTestIds.length
        : 0;
};

const getIncludedTestTitles = (product: PaymentProduct) => {
    if (!Array.isArray(product.includedMockTestIds)) {
        return [];
    }

    return product.includedMockTestIds
        .map((item) => {
            if (!item || typeof item === "string") {
                return "";
            }

            return item.title || item.slug || "";
        })
        .filter(Boolean);
};

export default function AdminPaymentPackagesPage() {
    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [adminToken, setAdminToken] = useState("");
    const [profile, setProfile] = useState<AdminProfile | null>(null);
    const [message, setMessage] = useState("");

    const [products, setProducts] = useState<PaymentProduct[]>([]);
    const [mockTests, setMockTests] = useState<MockTestSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<ToastState | null>(null);

    const [form, setForm] = useState<CreatePackForm>(initialCreatePackForm);
    const [editingProductId, setEditingProductId] = useState("");
    const [editForm, setEditForm] = useState<CreatePackForm>(initialCreatePackForm);

    const activeMockTests = useMemo(() => {
        return mockTests.filter((mockTest) => mockTest._id && mockTest.isActive !== false);
    }, [mockTests]);

    const activeProductCount = useMemo(() => {
        return products.filter((product) => product.isActive !== false).length;
    }, [products]);

    const inactiveProductCount = Math.max(products.length - activeProductCount, 0);

    useEffect(() => {
        if (!toast) {
            return;
        }

        const toastAutoDismissMs = 5000;
        const timerId = window.setTimeout(() => {
            setToast(null);
        }, toastAutoDismissMs);

        return () => window.clearTimeout(timerId);
    }, [toast]);

    const loadData = async (
        token: string,
        options: { clearToast?: boolean } = {}
    ) => {
        setIsLoading(true);

        if (options.clearToast !== false) {
            setToast(null);
        }

        try {
            const [productResponse, mockTestResponse] = await Promise.all([
                fetch(API_BASE_URL + "/api/payment-products?limit=100", {
                    headers: {
                        Authorization: "Bearer " + token,
                    },
                }),
                fetch(API_BASE_URL + "/api/mock-tests?limit=100", {
                    headers: {
                        Authorization: "Bearer " + token,
                    },
                }),
            ]);

            const productResult =
                (await productResponse.json()) as PaymentProductsResponse;

            if (!productResponse.ok || !productResult.success) {
                throw new Error(
                    productResult.message || "Unable to load payment packages."
                );
            }

            const mockTestResult =
                (await mockTestResponse.json()) as MockTestsResponse;

            if (!mockTestResponse.ok || !mockTestResult.success) {
                throw new Error(
                    mockTestResult.message || "Unable to load mock tests."
                );
            }

            setProducts(Array.isArray(productResult.data) ? productResult.data : []);
            setMockTests(Array.isArray(mockTestResult.data) ? mockTestResult.data : []);
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to load payment package data.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const verifyAdminSession = async () => {
            const savedToken =
                window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

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
                    setMessage("Payment packages can be managed only by Admin or Super Admin.");
                    return;
                }

                window.localStorage.setItem(
                    ADMIN_PROFILE_STORAGE_KEY,
                    JSON.stringify(result.data)
                );

                setProfile(result.data);
                setAdminToken(savedToken);
                setIsAllowed(true);
                setMessage("");
                await loadData(savedToken);
            } catch (error) {
                clearAdminSessionStorage();
                setAdminToken("");
                setProfile(null);
                setIsAllowed(false);
                setMessage(
                    error instanceof Error
                        ? error.message
                        : "Admin session is invalid."
                );
            } finally {
                setIsReady(true);
            }
        };

        void verifyAdminSession();
    }, []);

    const updateFormField = (field: keyof CreatePackForm, value: string) => {
        setForm((current) => {
            const next = {
                ...current,
                [field]: value,
            };

            if (field === "title") {
                next.slug = createSlugFromText(value);
            }

            return next;
        });
    };

    const toggleMockTestSelection = (mockTestId: string) => {
        setForm((current) => {
            const isSelected = current.selectedMockTestIds.includes(mockTestId);

            return {
                ...current,
                selectedMockTestIds: isSelected
                    ? current.selectedMockTestIds.filter((id) => id !== mockTestId)
                    : [...current.selectedMockTestIds, mockTestId],
            };
        });
    };

    const startEditingProduct = (product: PaymentProduct) => {
        const selectedMockTestIds = Array.isArray(product.includedMockTestIds)
            ? product.includedMockTestIds
                  .map((item) => {
                      if (!item) {
                          return "";
                      }

                      return typeof item === "string" ? item : item._id;
                  })
                  .filter(Boolean)
            : [];

        setEditingProductId(product._id);
        setEditForm({
            title: product.title || "",
            slug: product.slug || "",
            description: product.description || "",
            priceInRupees: String(Number(product.priceInPaise || 0) / 100),
            validityDays: String(product.validityDays || 30),
            selectedMockTestIds,
            sortOrder: String(product.sortOrder || 0),
        });
        setToast({
            type: "success",
            message: "Edit mode opened. Update the package and click Save Changes.",
        });
    };

    const cancelEditingProduct = () => {
        setEditingProductId("");
        setEditForm(initialCreatePackForm);
    };

    const updateEditFormField = (field: keyof CreatePackForm, value: string) => {
        setEditForm((current) => {
            const next = {
                ...current,
                [field]: value,
            };

            if (field === "title") {
                next.slug = createSlugFromText(value);
            }

            return next;
        });
    };

    const toggleEditMockTestSelection = (mockTestId: string) => {
        setEditForm((current) => {
            const isSelected = current.selectedMockTestIds.includes(mockTestId);

            return {
                ...current,
                selectedMockTestIds: isSelected
                    ? current.selectedMockTestIds.filter((id) => id !== mockTestId)
                    : [...current.selectedMockTestIds, mockTestId],
            };
        });
    };

    const validatePackForm = (targetForm: CreatePackForm) => {
        if (!hasText(targetForm.title)) {
            return "Package title is required.";
        }

        if (!hasText(targetForm.slug)) {
            return "Package slug is required.";
        }

        const priceInRupees = Number(targetForm.priceInRupees);

        if (!Number.isFinite(priceInRupees) || priceInRupees < 0) {
            return "Valid package price is required.";
        }

        const validityDays = Number(targetForm.validityDays);

        if (!Number.isFinite(validityDays) || validityDays < 1 || validityDays > 3650) {
            return "Validity must be between 1 and 3650 days.";
        }

        if (targetForm.selectedMockTestIds.length === 0) {
            return "Select at least one active mock test for this pack.";
        }

        return "";
    };

    const buildPackPayload = (targetForm: CreatePackForm) => {
        const priceInRupees = Number(targetForm.priceInRupees);
        const validityDays = Number(targetForm.validityDays);

        return {
            title: targetForm.title.trim(),
            slug: createSlugFromText(targetForm.slug),
            description: targetForm.description.trim(),
            productType: "mock_test_pack",
            priceInPaise: Math.round(priceInRupees * 100),
            validityDays: Math.trunc(validityDays),
            includedMockTestIds: targetForm.selectedMockTestIds,
            sortOrder: Math.trunc(Number(targetForm.sortOrder) || 0),
        };
    };

    const handleCreatePack = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!adminToken) {
            setToast({
                type: "error",
                message: "Admin session is missing. Please login again.",
            });
            return;
        }

        const validationError = validatePackForm(form);

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
            const response = await fetch(API_BASE_URL + "/api/payment-products", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + adminToken,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...buildPackPayload(form),
                    isActive: true,
                }),
            });

            const result = (await response.json()) as PaymentProductMutationResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to create payment package.");
            }

            setToast({
                type: "success",
                message: "Payment package created successfully.",
            });

            setForm(initialCreatePackForm);
            await loadData(adminToken, { clearToast: false });
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to create payment package.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveProductEdit = async () => {
        if (!adminToken || !editingProductId) {
            setToast({
                type: "error",
                message: "No package is selected for editing.",
            });
            return;
        }

        const validationError = validatePackForm(editForm);

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
            const response = await fetch(
                API_BASE_URL + "/api/payment-products/" + editingProductId,
                {
                    method: "PUT",
                    headers: {
                        Authorization: "Bearer " + adminToken,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(buildPackPayload(editForm)),
                }
            );

            const result = (await response.json()) as PaymentProductMutationResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to update payment package.");
            }

            setToast({
                type: "success",
                message: "Payment package updated successfully.",
            });

            cancelEditingProduct();
            await loadData(adminToken, { clearToast: false });
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to update payment package.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateProductActiveStatus = async (
        product: PaymentProduct,
        shouldActivate: boolean
    ) => {
        if (!adminToken) {
            setToast({
                type: "error",
                message: "Admin session is missing. Please login again.",
            });
            return;
        }

        const action = shouldActivate ? "reactivate" : "disable";

        const confirmMessage = shouldActivate
            ? "Reactivate this payment package?"
            : "Disable this payment package? Students will not be able to buy it while disabled.";

        if (!window.confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await fetch(
                API_BASE_URL + "/api/payment-products/" + product._id + "/" + action,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: "Bearer " + adminToken,
                    },
                }
            );

            const result = (await response.json()) as PaymentProductMutationResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to update payment package.");
            }

            setToast({
                type: "success",
                message: shouldActivate
                    ? "Payment package reactivated."
                    : "Payment package disabled.",
            });

            await loadData(adminToken, { clearToast: false });
        } catch (error) {
            setToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to update payment package.",
            });
        }
    };

    if (!isReady) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
                <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    Loading payment packages...
                </div>
            </main>
        );
    }

    if (!adminToken || !profile || !isAllowed) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
                <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                        Payment Packages
                    </p>

                    <h1 className="mt-3 text-2xl font-black">
                        Access restricted
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                        {message || "Please login with an Admin or Super Admin account."}
                    </p>

                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <Link
                            href="/admin/login"
                            className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            Go to Admin Login
                        </Link>

                        <Link
                            href="/admin/dashboard"
                            className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Back to Dashboard
                        </Link>
                    </div>
                    {/* T45V_PAYMENT_PACKAGES_LOGIN_LINK_DONE */}
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-700">
                                Payments
                            </p>

                            <h1 className="mt-2 text-3xl font-black tracking-tight">
                                Payment Packages
                            </h1>

                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                Create and manage paid mock test packs. Student access unlocks only after
                                backend payment verification.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => void loadData(adminToken)}
                                disabled={isLoading}
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isLoading ? "Refreshing..." : "Refresh"}
                            </button>

                            <Link
                                href="/admin/dashboard"
                                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                            >
                                Dashboard
                            </Link>
                        </div>
                    </div>
                </header>

                {toast ? (
                    <div
                        className={
                            "fixed right-4 top-4 z-50 max-w-sm rounded-3xl p-4 text-sm font-semibold shadow-2xl ring-1 " +
                            (toast.type === "success"
                                ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                                : "bg-red-50 text-red-800 ring-red-100")
                        }
                    >
                        <div className="flex items-start gap-3">
                            <span className="flex-1">{toast.message}</span>
                            <button
                                type="button"
                                onClick={() => setToast(null)}
                                className="rounded-full px-2 text-xs font-black hover:bg-white/70"
                            >
                                x
                            </button>
                        </div>
                    </div>
                ) : null}

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                            Total Packages
                        </p>
                        <p className="mt-2 text-3xl font-black">{products.length}</p>
                    </div>

                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                            Active Packages
                        </p>
                        <p className="mt-2 text-3xl font-black text-emerald-700">
                            {activeProductCount}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                            Active Mock Tests
                        </p>
                        <p className="mt-2 text-3xl font-black text-blue-700">
                            {activeMockTests.length}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                            Inactive packages: {inactiveProductCount}
                        </p>
                    </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
                    <form
                        onSubmit={handleCreatePack}
                        className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                    >
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">
                            Create Pack
                        </p>

                        <h2 className="mt-2 text-2xl font-black">
                            Mock Test Pack
                        </h2>

                        <div className="mt-6 space-y-4">
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700">
                                    Package title
                                </span>
                                <input
                                    value={form.title}
                                    onChange={(event) => updateFormField("title", event.target.value)}
                                    placeholder="Example: MPPSC Prelims Test Pack"
                                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                />
                            </label>

                            <label className="block">
                                <span className="text-sm font-bold text-slate-700">
                                    Slug
                                </span>
                                <input
                                    value={form.slug}
                                    onChange={(event) => updateFormField("slug", event.target.value)}
                                    placeholder="mppsc-prelims-test-pack"
                                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                />
                            </label>

                            <label className="block">
                                <span className="text-sm font-bold text-slate-700">
                                    Description
                                </span>
                                <textarea
                                    value={form.description}
                                    onChange={(event) => updateFormField("description", event.target.value)}
                                    placeholder="Short package description for students."
                                    rows={3}
                                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                />
                            </label>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">
                                        Price INR
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={form.priceInRupees}
                                        onChange={(event) => updateFormField("priceInRupees", event.target.value)}
                                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">
                                        Validity days
                                    </span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="3650"
                                        value={form.validityDays}
                                        onChange={(event) => updateFormField("validityDays", event.target.value)}
                                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">
                                        Sort order
                                    </span>
                                    <input
                                        type="number"
                                        value={form.sortOrder}
                                        onChange={(event) => updateFormField("sortOrder", event.target.value)}
                                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />
                                </label>
                            </div>

                            <div>
                                <p className="text-sm font-bold text-slate-700">
                                    Include active mock tests
                                </p>

                                <div className="mt-2 max-h-64 space-y-2 overflow-auto rounded-2xl border border-slate-200 p-3">
                                    {activeMockTests.length === 0 ? (
                                        <p className="text-sm text-red-600">
                                            No active mock test available. Create or reactivate a mock test first.
                                        </p>
                                    ) : (
                                        activeMockTests.map((mockTest) => (
                                            <label
                                                key={mockTest._id}
                                                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 p-3 hover:bg-slate-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={form.selectedMockTestIds.includes(mockTest._id)}
                                                    onChange={() => toggleMockTestSelection(mockTest._id)}
                                                    className="mt-1"
                                                />
                                                <span>
                                                    <span className="block text-sm font-black text-slate-900">
                                                        {mockTest.title || mockTest.slug || "Untitled Mock Test"}
                                                    </span>
                                                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                                                        {mockTest.accessType || "free"} -{" "}
                                                        {mockTest.isPublished ? "Published" : "Not published"}
                                                    </span>
                                                </span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || activeMockTests.length === 0}
                                className="w-full rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? "Creating..." : "Create Payment Package"}
                            </button>
                        </div>
                    </form>

                    {editingProductId ? (
                        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-sm font-black uppercase tracking-[0.2em] text-rose-700">
                                        Edit Pack
                                    </p>
                                    <h2 className="mt-2 text-2xl font-black">
                                        Update Payment Package
                                    </h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                        Change price, validity, title, description or included mock tests.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={cancelEditingProduct}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel Edit
                                </button>
                            </div>

                            <div className="mt-6 space-y-4">
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">
                                        Package title
                                    </span>
                                    <input
                                        value={editForm.title}
                                        onChange={(event) => updateEditFormField("title", event.target.value)}
                                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">
                                        Slug
                                    </span>
                                    <input
                                        value={editForm.slug}
                                        onChange={(event) => updateEditFormField("slug", event.target.value)}
                                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">
                                        Description
                                    </span>
                                    <textarea
                                        value={editForm.description}
                                        onChange={(event) => updateEditFormField("description", event.target.value)}
                                        rows={3}
                                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                    />
                                </label>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700">
                                            Price INR
                                        </span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={editForm.priceInRupees}
                                            onChange={(event) => updateEditFormField("priceInRupees", event.target.value)}
                                            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700">
                                            Validity days
                                        </span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="3650"
                                            value={editForm.validityDays}
                                            onChange={(event) => updateEditFormField("validityDays", event.target.value)}
                                            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700">
                                            Sort order
                                        </span>
                                        <input
                                            type="number"
                                            value={editForm.sortOrder}
                                            onChange={(event) => updateEditFormField("sortOrder", event.target.value)}
                                            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                                        />
                                    </label>
                                </div>

                                <div>
                                    <p className="text-sm font-bold text-slate-700">
                                        Included active mock tests
                                    </p>

                                    <div className="mt-2 max-h-64 space-y-2 overflow-auto rounded-2xl border border-slate-200 p-3">
                                        {activeMockTests.map((mockTest) => (
                                            <label
                                                key={mockTest._id}
                                                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 p-3 hover:bg-slate-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.selectedMockTestIds.includes(mockTest._id)}
                                                    onChange={() => toggleEditMockTestSelection(mockTest._id)}
                                                    className="mt-1"
                                                />
                                                <span>
                                                    <span className="block text-sm font-black text-slate-900">
                                                        {mockTest.title || mockTest.slug || "Untitled Mock Test"}
                                                    </span>
                                                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                                                        {mockTest.accessType || "free"} -{" "}
                                                        {mockTest.isPublished ? "Published" : "Not published"}
                                                    </span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => void handleSaveProductEdit()}
                                    disabled={isSubmitting}
                                    className="w-full rounded-2xl bg-rose-700 px-5 py-3 text-sm font-black text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSubmitting ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </section>
                    ) : null}

                    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">
                                    Existing Packages
                                </p>

                                <h2 className="mt-2 text-2xl font-black">
                                    Mock Test Packs
                                </h2>
                            </div>

                            <p className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
                                {products.length} total
                            </p>
                        </div>

                        <div className="mt-6 space-y-4">
                            {isLoading ? (
                                <div className="rounded-3xl bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                                    Loading packages...
                                </div>
                            ) : products.length === 0 ? (
                                <div className="rounded-3xl bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                                    No payment packages created yet.
                                </div>
                            ) : (
                                products.map((product) => {
                                    const includedTitles = getIncludedTestTitles(product);

                                    return (
                                        <article
                                            key={product._id}
                                            className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                                        >
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <span
                                                            className={
                                                                "rounded-full px-3 py-1 text-xs font-black " +
                                                                (product.isActive !== false
                                                                    ? "bg-emerald-100 text-emerald-800"
                                                                    : "bg-slate-200 text-slate-600")
                                                            }
                                                        >
                                                            {product.isActive !== false ? "Active" : "Disabled"}
                                                        </span>

                                                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">
                                                            {formatPrice(product.priceInPaise)}
                                                        </span>

                                                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                                                            {product.validityDays || 0} days
                                                        </span>
                                                    </div>

                                                    <h3 className="mt-3 text-xl font-black text-slate-950">
                                                        {product.title || "Untitled Package"}
                                                    </h3>

                                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                                        /{product.slug || "-"} - Created {formatDate(product.createdAt)}
                                                    </p>

                                                    {product.description ? (
                                                        <p className="mt-3 text-sm leading-6 text-slate-600">
                                                            {product.description}
                                                        </p>
                                                    ) : null}

                                                    <p className="mt-3 text-sm font-bold text-slate-700">
                                                        Included tests: {getIncludedTestCount(product)}
                                                    </p>

                                                    {includedTitles.length > 0 ? (
                                                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                                                            {includedTitles.map((title) => (
                                                                <li key={title}>{title}</li>
                                                            ))}
                                                        </ul>
                                                    ) : null}
                                                </div>

                                                <div className="flex shrink-0 flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => startEditingProduct(product)}
                                                        className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                                                    >
                                                        Edit
                                                    </button>

                                                    {product.isActive !== false ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => void updateProductActiveStatus(product, false)}
                                                            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                                                        >
                                                            Disable
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => void updateProductActiveStatus(product, true)}
                                                            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                                                        >
                                                            Reactivate
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })
                            )}
                        </div>
                    </section>
                </section>
            </div>
        </main>
    );
}

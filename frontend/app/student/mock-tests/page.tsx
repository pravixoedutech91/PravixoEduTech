"use client";


import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PrimaryAction =
    | "start"
    | "resume"
    | "view_result"
    | "view_review"
    | "retake"
    | "limit_reached";

type MockTest = {
    _id: string;
    title: string;
    slug: string;
    description?: string;
    testType: string;
    accessType: string;
    examPattern: {
        name: string;
        examType: string;
        totalDurationMinutes: number;
    } | null;
    activeVersion: {
        versionNumber: number;
        publishedAt: string;
    } | null;
    studentAttemptSummary: {
        maxAttempts: number;
        attemptsUsed: number;
        attemptsRemaining: number;
        latestAttemptId: string | null;
        latestAttemptNumber: number | null;
        latestAttemptStatus: string | null;
        canRetake: boolean;
        isAttemptLimitReached: boolean;
        primaryAction: PrimaryAction;
        result: {
            attemptId?: string | null;
            isResultVisible: boolean;
        };
        review: {
            attemptId?: string | null;
            isDetailedReviewAvailable: boolean;
        };
    };
};

type MockTestsResponse = {
    success: boolean;
    count: number;
    data: MockTest[];
    message?: string;
};

type StartAttemptResponse = {
    success: boolean;
    message: string;
    data?: {
        resumed: boolean;
        serverTime: string;
        attempt: {
            _id: string;
            attemptNumber: number;
            status: string;
            expiresAt?: string;
        };
    };
};

type StudentPaymentPackageMockTest = {
    _id: string;
    title?: string;
    slug?: string;
    description?: string;
    testType?: string;
    accessType?: string;
    isPublished?: boolean;
    isActive?: boolean;
};

type StudentPaymentPackage = {
    _id: string;
    title: string;
    slug: string;
    description?: string;
    productType: "mock_test_pack";
    priceInPaise: number;
    priceInRupees: number;
    currency: "INR";
    validityDays: number;
    includedMockTestCount: number;
    includedMockTests: StudentPaymentPackageMockTest[];
    isActive: boolean;
    isPurchased?: boolean;
    hasActiveEntitlement?: boolean;
    accessStatus?: "active" | "not_purchased" | string;
    entitlement?: {
        _id?: string;
        entitlementType?: string;
        status?: string;
        validFrom?: string;
        validUntil?: string;
        mockTestIds?: string[];
    } | null;
};

type StudentPaymentPackagesResponse = {
    success: boolean;
    count: number;
    data: StudentPaymentPackage[];
    message?: string;
};

const isPaymentPackageAccessActive = (paymentPackage: StudentPaymentPackage) => {
    return Boolean(
        paymentPackage.isPurchased ||
            paymentPackage.hasActiveEntitlement ||
            paymentPackage.accessStatus === "active"
    );
};

type StudentCreatePaymentOrderResponse = {
    success: boolean;
    message: string;
    data?: {
        purchase: {
            _id: string;
            status: string;
            amountInPaise: number;
            currency: "INR";
            receipt: string;
        };
        product: {
            _id: string;
            title: string;
            slug: string;
            productType: "mock_test_pack";
            priceInPaise: number;
            priceInRupees: number;
            currency: "INR";
            validityDays: number;
        };
        razorpay: {
            keyId: string;
            orderId: string;
            amount: number;
            currency: "INR";
            receipt: string;
        };
    };
};

type StudentVerifyPaymentResponse = {
    success: boolean;
    message: string;
    data?: {
        purchase?: {
            _id: string;
            status: string;
            amountInPaise: number;
            currency: "INR";
            razorpayOrderId: string;
            razorpayPaymentId: string;
            paidAt?: string;
        };
        entitlement?: {
            _id: string;
            entitlementType: string;
            status: string;
            validFrom: string;
            validUntil: string;
            mockTestIds: string[];
        } | null;
    };
};

type RazorpayPaymentResponse = {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpayPaymentResponse) => void;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
        color?: string;
    };
    modal?: {
        ondismiss?: () => void;
    };
};

type RazorpayCheckoutInstance = {
    open: () => void;
};

declare global {
    interface Window {
        Razorpay?: new (
            options: RazorpayCheckoutOptions
        ) => RazorpayCheckoutInstance;
    }
}

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const STUDENT_TOKEN_STORAGE_KEY = "pravixoStudentToken";
const ACTIVE_ATTEMPT_STORAGE_KEY = "pravixoActiveAttempt";
const ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY = "pravixoActiveAttemptPayload";
const STUDENT_PROFILE_STORAGE_KEY = "pravixoStudentProfile";

const INVALID_STUDENT_SESSION_MESSAGE =
    "Your student session has expired or was invalidated. Please login again.";

const clearStudentSessionStorage = () => {
    window.localStorage.removeItem(STUDENT_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STUDENT_PROFILE_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY);
};

const isInvalidStudentSessionResponse = (
    response: Response,
    message?: string
) => {
    const normalizedMessage = (message || "").toLowerCase();

    return (
        response.status === 401 ||
        response.status === 403 ||
        normalizedMessage.includes("jwt expired") ||
        normalizedMessage.includes("invalid token") ||
        normalizedMessage.includes("not authorized") ||
        normalizedMessage.includes("session invalid")
    );
};

const actionLabels: Record<PrimaryAction, string> = {
    start: "Start Test",
    resume: "Resume Test",
    view_result: "View Result",
    view_review: "View Review",
    retake: "Retake Test",
    limit_reached: "Attempt Limit Reached",
};

const getActionClassName = (action: PrimaryAction) => {
    if (action === "resume") {
        return "bg-amber-600 hover:bg-amber-700";
    }

    if (action === "view_review") {
        return "bg-emerald-600 hover:bg-emerald-700";
    }

    if (action === "view_result") {
        return "bg-blue-600 hover:bg-blue-700";
    }

    if (action === "retake") {
        return "bg-purple-600 hover:bg-purple-700";
    }

    if (action === "limit_reached") {
        return "bg-slate-500";
    }

    return "bg-slate-900 hover:bg-slate-800";
};

const isAttemptStartAction = (action: PrimaryAction) => {
    return action === "start" || action === "resume" || action === "retake";
};

const RAZORPAY_CHECKOUT_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

const loadRazorpayCheckoutScript = () => {
    return new Promise<boolean>((resolve) => {
        if (typeof window === "undefined") {
            resolve(false);
            return;
        }

        if (window.Razorpay) {
            resolve(true);
            return;
        }

        const existingScript = document.querySelector<HTMLScriptElement>(
            'script[src="' + RAZORPAY_CHECKOUT_SCRIPT_URL + '"]'
        );

        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(true), {
                once: true,
            });
            existingScript.addEventListener("error", () => resolve(false), {
                once: true,
            });
            return;
        }

        const script = document.createElement("script");
        script.src = RAZORPAY_CHECKOUT_SCRIPT_URL;
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);

        document.body.appendChild(script);
    });
};

const getStudentCheckoutPrefill = () => {
    if (typeof window === "undefined") {
        return {};
    }

    try {
        const rawProfile = window.localStorage.getItem("pravixoStudentProfile");

        if (!rawProfile) {
            return {};
        }

        const profile = JSON.parse(rawProfile) as {
            name?: string;
            fullName?: string;
            email?: string;
            phone?: string;
            mobile?: string;
            contact?: string;
        };

        return {
            name: profile.name || profile.fullName || "",
            email: profile.email || "",
            contact: profile.phone || profile.mobile || profile.contact || "",
        };
    } catch {
        return {};
    }
};

const formatPrice = (priceInPaise?: number) => {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(priceInPaise || 0) / 100);
};

export default function StudentMockTestsPage() {
    const router = useRouter();
    const [token, setToken] = useState("");
    const [isClientReady, setIsClientReady] = useState(false);
    const [mockTests, setMockTests] = useState<MockTest[]>([]);
    const [paymentPackages, setPaymentPackages] = useState<StudentPaymentPackage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingPackages, setIsLoadingPackages] = useState(false);
    const [checkoutPackageId, setCheckoutPackageId] = useState<string | null>(null);
    const [actionLoadingMockTestId, setActionLoadingMockTestId] = useState<
        string | null
    >(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [actionMessage, setActionMessage] = useState("");

    const loadMockTests = useCallback(async (tokenOverride?: string) => {
        const cleanToken = (tokenOverride || token).trim();

        if (!cleanToken) {
            setErrorMessage("Please login as a student first.");
            return;
        }

        window.localStorage.setItem(STUDENT_TOKEN_STORAGE_KEY, cleanToken);

        setIsLoading(true);
        setErrorMessage("");
        setActionMessage("");

        try {
            const response = await fetch(`${API_BASE_URL}/api/student/mock-tests`, {
                headers: {
                    Authorization: `Bearer ${cleanToken}`,
                },
                cache: "no-store",
            });

            const result = (await response.json()) as MockTestsResponse;

            if (isInvalidStudentSessionResponse(response, result.message)) {
                clearStudentSessionStorage();
                setToken("");
                setMockTests([]);
                setPaymentPackages([]);
                setActionMessage("");
                setErrorMessage(INVALID_STUDENT_SESSION_MESSAGE);
                router.push("/student/login");
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load mock tests.");
            }

            setMockTests(result.data || []);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Something went wrong while loading mock tests.";

            setErrorMessage(message);
            setMockTests([]);
        } finally {
            setIsLoading(false);
        }
    }, [router, token]);

    const loadPaymentPackages = useCallback(async (tokenOverride?: string) => {
        const cleanToken = (tokenOverride || token).trim();

        if (!cleanToken) {
            setPaymentPackages([]);
            return;
        }

        setIsLoadingPackages(true);

        try {
            const response = await fetch(API_BASE_URL + "/api/student/payment-packages", {
                headers: {
                    Authorization: "Bearer " + cleanToken,
                },
                cache: "no-store",
            });

            const result = (await response.json()) as StudentPaymentPackagesResponse;

            if (isInvalidStudentSessionResponse(response, result.message)) {
                clearStudentSessionStorage();
                setToken("");
                setMockTests([]);
                setPaymentPackages([]);
                setActionMessage("");
                setErrorMessage(INVALID_STUDENT_SESSION_MESSAGE);
                router.push("/student/login");
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load payment packages.");
            }

            setPaymentPackages(Array.isArray(result.data) ? result.data : []);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Something went wrong while loading payment packages.";

            setErrorMessage(message);
            setPaymentPackages([]);
        } finally {
            setIsLoadingPackages(false);
        }
    }, [router, token]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const storedToken =
                window.localStorage.getItem(STUDENT_TOKEN_STORAGE_KEY) || "";
            const cleanToken = storedToken.trim();

            if (cleanToken) {
                setToken(cleanToken);
            } else {
                setErrorMessage("Please login as a student first.");
            }

            setIsClientReady(true);
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isClientReady || !token.trim()) {
            return;
        }

        const timer = window.setTimeout(() => {
            void loadMockTests(token);
            void loadPaymentPackages(token);
        }, 0);

        return () => window.clearTimeout(timer);
    }, [isClientReady, loadMockTests, loadPaymentPackages, token]);

    useEffect(() => {
        if (!isClientReady || !token.trim()) {
            return;
        }

        const handleMockTestPageShow = () => {
            void loadMockTests(token);
            void loadPaymentPackages(token);
        };

        const handleMockTestVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void loadMockTests(token);
            void loadPaymentPackages(token);
            }
        };

        window.addEventListener("pageshow", handleMockTestPageShow);
        document.addEventListener(
            "visibilitychange",
            handleMockTestVisibilityChange
        );

        return () => {
            window.removeEventListener("pageshow", handleMockTestPageShow);
            document.removeEventListener(
                "visibilitychange",
                handleMockTestVisibilityChange
            );
        };
    }, [isClientReady, loadMockTests, loadPaymentPackages, token]);

    const handleLogout = () => {
        const shouldLogout = window.confirm(
            "Are you sure you want to logout? Your saved student session will be cleared."
        );

        if (!shouldLogout) {
            return;
        }

        clearStudentSessionStorage();

        setToken("");
        setMockTests([]);
        setPaymentPackages([]);
        setActionMessage("");
        setErrorMessage("You have been logged out. Please login again.");

        router.push("/student/login");
    };

    const showPendingActionMessage = (mockTest: MockTest) => {
        const action = mockTest.studentAttemptSummary.primaryAction;

        setActionMessage(
            `${actionLabels[action]} for "${mockTest.title}" will be connected in a later frontend step.`
        );
    };

    const startOrResumeAttempt = async (
        mockTest: MockTest,
        requestedAction: "start" | "resume" | "retake"
    ) => {
        const cleanToken = token.trim();

        if (!cleanToken) {
            setErrorMessage("Please login as a student first.");
            return;
        }

        setActionLoadingMockTestId(mockTest._id);
        setErrorMessage("");
        setActionMessage("");

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/student/mock-tests/${mockTest._id}/start`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${cleanToken}`,
                    },
                }
            );

            const result = (await response.json()) as StartAttemptResponse;

            if (isInvalidStudentSessionResponse(response, result.message)) {
                clearStudentSessionStorage();
                setToken("");
                setMockTests([]);
                setPaymentPackages([]);
                setActionMessage("");
                setErrorMessage(INVALID_STUDENT_SESSION_MESSAGE);
                router.push("/student/login");
                return;
            }

            if (!response.ok || !result.success || !result.data) {
                throw new Error(result.message || "Unable to start test.");
            }

            const attempt = result.data.attempt;

            window.localStorage.setItem(
                ACTIVE_ATTEMPT_STORAGE_KEY,
                JSON.stringify({
                    mockTestId: mockTest._id,
                    mockTestTitle: mockTest.title,
                    requestedAction,
                    resumed: result.data.resumed,
                    attemptId: attempt._id,
                    attemptNumber: attempt.attemptNumber,
                    status: attempt.status,
                    expiresAt: attempt.expiresAt || null,
                    serverTime: result.data.serverTime,
                })
            );

            window.localStorage.setItem(
                ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY,
                JSON.stringify(result.data)
            );

            const actionText = result.data.resumed
                ? "Resumed"
                : requestedAction === "retake"
                    ? "Started retake"
                    : "Started";

            setActionMessage(
                `${actionText} attempt #${attempt.attemptNumber} for "${mockTest.title}". Opening attempt interface.`
            );

            window.location.assign(`/student/attempts/${attempt._id}`);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unable to start or resume this test.";

            setErrorMessage(message);
        } finally {
            setActionLoadingMockTestId(null);
        }
    };

    const openAttemptResult = (mockTest: MockTest) => {
        const attemptId =
            mockTest.studentAttemptSummary.result.attemptId ||
            mockTest.studentAttemptSummary.latestAttemptId;

        if (!attemptId) {
            setActionMessage(
                "Result is available, but attempt ID is missing. Please reload mock tests."
            );
            return;
        }

        router.push(`/student/attempts/${attemptId}/result`);
    };

    const openAttemptReview = (mockTest: MockTest) => {
        const attemptId =
            mockTest.studentAttemptSummary.review.attemptId ||
            mockTest.studentAttemptSummary.latestAttemptId;

        if (!attemptId) {
            setActionMessage(
                "Review is available, but attempt ID is missing. Please reload mock tests."
            );
            return;
        }

        router.push(`/student/attempts/${attemptId}/review`);
    };
    const handleBuyPaymentPackage = async (paymentPackage: StudentPaymentPackage) => {
        const cleanToken = token.trim();

        if (!cleanToken) {
            setErrorMessage("Please login first to buy a mock test package.");
            router.push("/student/login");
            return;
        }

        if (isPaymentPackageAccessActive(paymentPackage)) {
            setErrorMessage("");
            setActionMessage(
                paymentPackage.title + " is already purchased. Your access is active."
            );
            return;
        }

        setCheckoutPackageId(paymentPackage._id);
        setErrorMessage("");
        setActionMessage("Creating payment order for " + paymentPackage.title + "...");

        try {
            const createOrderResponse = await fetch(
                API_BASE_URL +
                    "/api/student/payment-packages/" +
                    paymentPackage._id +
                    "/create-order",
                {
                    method: "POST",
                    headers: {
                        Authorization: "Bearer " + cleanToken,
                    },
                }
            );

            const createOrderResult =
                (await createOrderResponse.json()) as StudentCreatePaymentOrderResponse;

            if (
                isInvalidStudentSessionResponse(
                    createOrderResponse,
                    createOrderResult.message
                )
            ) {
                clearStudentSessionStorage();
                setToken("");
                setMockTests([]);
                setPaymentPackages([]);
                setActionMessage("");
                setErrorMessage(INVALID_STUDENT_SESSION_MESSAGE);
                router.push("/student/login");
                return;
            }

            if (!createOrderResponse.ok || !createOrderResult.success || !createOrderResult.data) {
                throw new Error(
                    createOrderResult.message || "Unable to create payment order."
                );
            }

            const isScriptLoaded = await loadRazorpayCheckoutScript();

            if (!isScriptLoaded || !window.Razorpay) {
                throw new Error("Razorpay checkout could not be loaded. Please try again.");
            }

            const { purchase, product, razorpay } = createOrderResult.data;

            setActionMessage("Opening Razorpay Checkout for " + product.title + "...");

            const verifyPayment = async (paymentResponse: RazorpayPaymentResponse) => {
                setActionMessage("Verifying payment and unlocking mock test access...");

                try {
                    const verifyResponse = await fetch(
                        API_BASE_URL + "/api/student/payment-packages/verify-payment",
                        {
                            method: "POST",
                            headers: {
                                Authorization: "Bearer " + cleanToken,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                purchaseId: purchase._id,
                                razorpay_order_id: paymentResponse.razorpay_order_id,
                                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                                razorpay_signature: paymentResponse.razorpay_signature,
                            }),
                        }
                    );

                    const verifyResult =
                        (await verifyResponse.json()) as StudentVerifyPaymentResponse;

                    if (
                        isInvalidStudentSessionResponse(
                            verifyResponse,
                            verifyResult.message
                        )
                    ) {
                        clearStudentSessionStorage();
                        setToken("");
                        setMockTests([]);
                        setPaymentPackages([]);
                        setActionMessage("");
                        setErrorMessage(INVALID_STUDENT_SESSION_MESSAGE);
                        router.push("/student/login");
                        return;
                    }

                    if (!verifyResponse.ok || !verifyResult.success) {
                        throw new Error(
                            verifyResult.message ||
                                "Payment could not be verified. Please contact support."
                        );
                    }

                    setActionMessage(
                        "Payment verified. Mock test access unlocked for " +
                            product.title +
                            ". Refreshing tests..."
                    );

                    await loadPaymentPackages(cleanToken);
                    await loadMockTests(cleanToken);
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : "Payment verification failed.";

                    setErrorMessage(message);
                } finally {
                    setCheckoutPackageId(null);
                }
            };

            const checkout = new window.Razorpay({
                key: razorpay.keyId,
                amount: razorpay.amount,
                currency: razorpay.currency,
                name: "PravixoEduTech",
                description: product.title,
                order_id: razorpay.orderId,
                prefill: getStudentCheckoutPrefill(),
                notes: {
                    purchaseId: purchase._id,
                    productId: product._id,
                    productSlug: product.slug,
                },
                theme: {
                    color: "#0f172a",
                },
                modal: {
                    ondismiss: () => {
                        setCheckoutPackageId(null);
                        setActionMessage(
                            "Payment checkout closed for " + product.title + "."
                        );
                    },
                },
                handler: (paymentResponse) => {
                    void verifyPayment(paymentResponse);
                },
            });

            checkout.open();
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Something went wrong while opening checkout.";

            setErrorMessage(message);
            setCheckoutPackageId(null);
        }
    };

    const handlePrimaryAction = (mockTest: MockTest) => {
        const action = mockTest.studentAttemptSummary.primaryAction;

        if (isAttemptStartAction(action)) {
            void startOrResumeAttempt(mockTest, action);
            return;
        }

        if (action === "view_result") {
            openAttemptResult(mockTest);
            return;
        }

        if (action === "view_review") {
            openAttemptReview(mockTest);
            return;
        }

        showPendingActionMessage(mockTest);
    };
    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
            <div className="mx-auto max-w-5xl">
                <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                        PravixoEduTech Student Panel
                    </p>

                    <h1 className="mt-2 text-3xl font-bold">
                        Mock Tests
                    </h1>

                    <p className="mt-2 text-sm text-slate-600">
                        Student mock test listing page using backend dashboard
                        action summary.
                    </p>
                </section>

                <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                                Student Session
                            </p>

                            <h2 className="mt-2 text-2xl font-bold">
                                Mock Test Access
                            </h2>

                            <p className="mt-2 max-w-2xl text-sm text-slate-600">
                                {token.trim()
                                    ? "You are logged in. Your mock tests load automatically from your saved student session."
                                    : "Please login first to access your assigned mock tests."}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {token.trim() ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        void loadMockTests();
                                        void loadPaymentPackages();
                                    }}
                                    disabled={isLoading || isLoadingPackages || !isClientReady}
                                    className="min-h-12 rounded-2xl bg-blue-700 px-6 text-sm font-semibold text-white disabled:bg-slate-400"
                                >
                                    {isLoading || isLoadingPackages ? "Loading..." : "Refresh"}
                                </button>
                            ) : (
                                <Link
                                    href="/student/login"
                                    className="flex min-h-12 items-center justify-center rounded-2xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800"
                                >
                                    Login
                                </Link>
                            )}

                            <Link
                                href="/student/attempts"
                                className="flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                My Attempts
                            </Link>

                            {token.trim() ? (
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="min-h-12 rounded-2xl border border-red-200 bg-red-50 px-6 text-sm font-semibold text-red-700 hover:bg-red-100"
                                >
                                    Logout
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {errorMessage ? (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            {errorMessage}
                        </div>
                    ) : null}

                    {actionMessage ? (
                        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
                            {actionMessage}
                        </div>
                    ) : null}
                </section>

                <section className="mb-8">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                                Payments
                            </p>
                            <h2 className="text-xl font-bold">
                                Paid Mock Test Packs
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Buy a test pack using Razorpay Test Mode. Access unlocks only after backend payment verification.
                            </p>
                        </div>

                        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                            {paymentPackages.length} pack(s)
                        </span>
                    </div>

                    {!token.trim() ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                            Login as a student to view paid packages.
                        </div>
                    ) : isLoadingPackages ? (
                        <div className="rounded-3xl bg-white p-6 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
                            Loading payment packages...
                        </div>
                    ) : paymentPackages.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                            No active paid mock test pack is available right now.
                        </div>
                    ) : (
                        <div className="grid gap-5 md:grid-cols-2">
                            {paymentPackages.map((paymentPackage) => (
                                <article
                                    key={paymentPackage._id}
                                    className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                                >
                                    <div className="flex flex-wrap gap-2">
                                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                            {formatPrice(paymentPackage.priceInPaise)}
                                        </span>
                                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                            {paymentPackage.validityDays} days
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                            {paymentPackage.includedMockTestCount} test(s)
                                        </span>
                                        {isPaymentPackageAccessActive(paymentPackage) ? (
                                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                                Access Active
                                            </span>
                                        ) : null}
                                    </div>

                                    <h3 className="mt-4 text-xl font-bold">
                                        {paymentPackage.title}
                                    </h3>

                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                        {paymentPackage.description || "Paid mock test package for exam preparation."}
                                    </p>

                                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            Included tests
                                        </p>

                                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                                            {paymentPackage.includedMockTests.map((mockTest) => (
                                                <li key={mockTest._id}>
                                                    {mockTest.title || mockTest.slug || "Mock Test"}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => void handleBuyPaymentPackage(paymentPackage)}
                                        disabled={
                                            checkoutPackageId === paymentPackage._id ||
                                            isPaymentPackageAccessActive(paymentPackage)
                                        }
                                        className={
                                            "mt-5 w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed " +
                                            (isPaymentPackageAccessActive(paymentPackage)
                                                ? "bg-emerald-600 disabled:bg-emerald-600"
                                                : "bg-slate-950 hover:bg-slate-800 disabled:bg-slate-400")
                                        }
                                    >
                                        {isPaymentPackageAccessActive(paymentPackage)
                                            ? "Purchased - Access Active"
                                            : checkoutPackageId === paymentPackage._id
                                              ? "Opening Checkout..."
                                              : "Buy Now"}
                                    </button>
                                    {paymentPackage.entitlement?.validUntil ? (
                                        <p className="mt-2 text-center text-xs font-medium text-emerald-700">
                                            Access valid until{" "}
                                            {new Date(
                                                paymentPackage.entitlement.validUntil
                                            ).toLocaleDateString("en-IN", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </p>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold">
                            Available Tests
                        </h2>

                        <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold">
                            {mockTests.length} test(s)
                        </span>
                    </div>

                    {mockTests.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                            No mock tests loaded yet.
                        </div>
                    ) : (
                        <div className="grid gap-5">
                            {mockTests.map((mockTest) => {
                                const summary = mockTest.studentAttemptSummary;
                                const action = summary.primaryAction;
                                const isActionLoading =
                                    actionLoadingMockTestId === mockTest._id;

                                return (
                                    <article
                                        key={mockTest._id}
                                        className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                                    >
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                                {mockTest.testType}
                                            </span>

                                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                                {mockTest.accessType}
                                            </span>

                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                Version {mockTest.activeVersion?.versionNumber || "-"}
                                            </span>
                                        </div>

                                        <h3 className="text-xl font-bold">
                                            {mockTest.title}
                                        </h3>

                                        <p className="mt-2 text-sm text-slate-600">
                                            {mockTest.description || "No description available."}
                                        </p>

                                        <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-4">
                                            <div>
                                                <p className="text-xs font-semibold uppercase text-slate-500">
                                                    Pattern
                                                </p>
                                                <p className="mt-1 font-semibold">
                                                    {mockTest.examPattern?.name || "Not assigned"}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs font-semibold uppercase text-slate-500">
                                                    Duration
                                                </p>
                                                <p className="mt-1 font-semibold">
                                                    {mockTest.examPattern?.totalDurationMinutes || "-"} min
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs font-semibold uppercase text-slate-500">
                                                    Attempts
                                                </p>
                                                <p className="mt-1 font-semibold">
                                                    {summary.attemptsUsed}/{summary.maxAttempts}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs font-semibold uppercase text-slate-500">
                                                    Remaining
                                                </p>
                                                <p className="mt-1 font-semibold">
                                                    {summary.attemptsRemaining}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-xs font-semibold uppercase text-slate-500">
                                                    Current Action
                                                </p>

                                                <p className="mt-1 font-semibold">
                                                    {actionLabels[action]}
                                                </p>

                                                <p className="mt-1 text-xs text-slate-500">
                                                    Latest attempt:{" "}
                                                    {summary.latestAttemptNumber
                                                        ? `#${summary.latestAttemptNumber} - ${summary.latestAttemptStatus}`
                                                        : "No attempt yet"}
                                                </p>

                                                <p className="mt-1 text-xs text-slate-500">
                                                    Result:{" "}
                                                    {summary.result.isResultVisible
                                                        ? "Visible"
                                                        : "Hidden"}{" "}
                                                    | Review:{" "}
                                                    {summary.review.isDetailedReviewAvailable
                                                        ? "Available"
                                                        : "Not available"}{" "}
                                                    | Limit:{" "}
                                                    {summary.isAttemptLimitReached
                                                        ? "Reached"
                                                        : "Available"}
                                                </p>
                                            </div>

                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrimaryAction(mockTest)}
                                                    disabled={
                                                        action === "limit_reached" ||
                                                        isActionLoading
                                                    }
                                                    className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400 ${getActionClassName(
                                                        action
                                                    )}`}
                                                >
                                                    {isActionLoading
                                                        ? "Please wait..."
                                                        : actionLabels[action]}
                                                </button>

                                                {summary.result.isResultVisible && action !== "view_result" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openAttemptResult(mockTest)}
                                                        disabled={isActionLoading}
                                                        className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                                    >
                                                        View Result
                                                    </button>
                                                ) : null}

                                                {summary.review.isDetailedReviewAvailable && action !== "view_review" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openAttemptReview(mockTest)}
                                                        disabled={isActionLoading}
                                                        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                                    >
                                                        View Review
                                                    </button>
                                                ) : null}

                                                {summary.canRetake &&
                                                    action !== "retake" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void startOrResumeAttempt(
                                                                mockTest,
                                                                "retake"
                                                            )
                                                        }
                                                        disabled={isActionLoading}
                                                        className="rounded-2xl border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-semibold text-purple-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                                    >
                                                        Retake Test
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
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

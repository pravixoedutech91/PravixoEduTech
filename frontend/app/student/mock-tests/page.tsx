"use client";


import { secureLogout } from "../../../lib/secureLogout";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import StudentPortalShell, { type StudentPortalProfile } from "@/components/student/StudentPortalShell";
import { useRouter } from "next/navigation";

type PrimaryAction =
    | "start"
    | "resume"
    | "view_result"
    | "view_review"
    | "retake"
    | "limit_reached"
    | "purchase_required"
    | "assignment_required";

type StudentTestType = "mock" | "pyq";

type MockTest = {
    _id: string;
    title: string;
    slug: string;
    description?: string;
    testType: string;
    accessType: string;
    category: {
        _id: string;
        name: string;
        slug: string;
    } | null;
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
        access?: {
            canAttempt: boolean;
            reason:
                | "purchase_required"
                | "assignment_required"
                | null;
        };
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
const getStoredStudentPortalProfile = (): StudentPortalProfile | null => {
    if (typeof window === "undefined") {
        return null;
    }

    const rawProfile = window.localStorage.getItem(
        STUDENT_PROFILE_STORAGE_KEY
    );

    if (!rawProfile) {
        return null;
    }

    try {
        const parsedProfile = JSON.parse(
            rawProfile
        ) as StudentPortalProfile;

        return parsedProfile &&
            typeof parsedProfile === "object"
            ? parsedProfile
            : null;
    } catch {
        return null;
    }
};

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
    purchase_required: "Purchase Required",
    assignment_required: "Assignment Required",
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

    if (action === "purchase_required") {
        return "bg-amber-600 hover:bg-amber-700";
    }

    if (action === "assignment_required") {
        return "bg-slate-600 hover:bg-slate-700";
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
        const savedProfile = window.localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);

        if (!savedProfile) {
            return {};
        }

        const profile = JSON.parse(savedProfile) as {
            name?: string;
            fullName?: string;
            email?: string;
            mobile?: string;
        };

        const rawMobile = String(profile.mobile || "").replace(/\D/g, "");
        const normalizedMobile =
            rawMobile.length === 12 && rawMobile.startsWith("91")
                ? rawMobile.slice(2)
                : rawMobile;

        return {
            name: profile.name || profile.fullName || "",
            email: profile.email || "",
            contact: /^\d{10}$/.test(normalizedMobile) ? normalizedMobile : undefined,
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
    const [activeTestType, setActiveTestType] = useState<StudentTestType>("mock");
    const [paymentPackages, setPaymentPackages] = useState<StudentPaymentPackage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingPackages, setIsLoadingPackages] = useState(false);
    const [checkoutPackageId, setCheckoutPackageId] = useState<string | null>(null);
    const [actionLoadingMockTestId, setActionLoadingMockTestId] = useState<
        string | null
    >(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [actionMessage, setActionMessage] = useState("");

    const mockTestCount = mockTests.filter(
        (mockTest) => mockTest.testType === "mock"
    ).length;

    const pyqTestCount = mockTests.filter(
        (mockTest) => mockTest.testType === "pyq"
    ).length;

    const studentCatalogTestCount = mockTestCount + pyqTestCount;

    const visibleTests = mockTests.filter(
        (mockTest) => mockTest.testType === activeTestType
    );

    useEffect(() => {
        if (!actionMessage) {
            return;
        }

        const actionMessageTimer = window.setTimeout(() => {
            setActionMessage("");
        }, 3000);

        return () => {
            window.clearTimeout(actionMessageTimer);
        };
    }, [actionMessage]);

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

    const handleLogout = async () => {
        const shouldLogout = window.confirm(
            "Are you sure you want to logout? Your saved student session will be cleared."
        );

        if (!shouldLogout) {
            return;
        }

        const logoutResult = await secureLogout(token);

        if (!logoutResult.shouldClearLocalSession) {
            setActionMessage("");
            setErrorMessage(
                "Secure logout could not be confirmed. Please check your connection and try again."
            );
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

        if (action === "purchase_required") {
            setActionMessage(
                `Purchase required before starting "${mockTest.title}". Choose an available payment package on this page.`
            );
            return;
        }

        if (action === "assignment_required") {
            setActionMessage(
                `"${mockTest.title}" requires assignment by your institute before it can be started.`
            );
            return;
        }

        setActionMessage(
            `${actionLabels[action]} for "${mockTest.title}" will be connected in a later frontend step.`
        );
    };

    const showAccessRequiredMessage = (mockTest: MockTest) => {
        const accessReason =
            mockTest.studentAttemptSummary.access?.reason;

        if (accessReason === "purchase_required") {
            setActionMessage(
                `Purchase required before retaking "${mockTest.title}". Choose an available payment package on this page.`
            );
            return;
        }

        if (accessReason === "assignment_required") {
            setActionMessage(
                `"${mockTest.title}" requires assignment by your institute before it can be retaken.`
            );
            return;
        }

        setActionMessage(
            `Access is required before "${mockTest.title}" can be retaken.`
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
        <StudentPortalShell
            profile={
                isClientReady && token.trim()
                    ? getStoredStudentPortalProfile()
                    : null
            }
            isSyncing={isLoading || isLoadingPackages}
            onLogout={handleLogout}
        >
            <div className="space-y-7 text-slate-950">
                {actionMessage ? (
                    <div
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        className="fixed left-1/2 top-20 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-800 shadow-xl shadow-slate-950/10"
                    >
                        {actionMessage}
                    </div>
                ) : null}

                {errorMessage ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        {errorMessage}
                    </div>
                ) : null}

                <section className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                            Pravixo Practice
                        </p>

                        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                            Mock Tests &amp; PYQs
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                            Practice like the real exam with structured mock tests,
                            previous year papers and performance-focused attempts.
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:min-w-[280px]">
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
                            <p className="text-lg font-black text-slate-950">
                                {studentCatalogTestCount}
                            </p>
                            <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                Tests
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
                            <p className="text-lg font-black text-blue-700">
                                {mockTestCount}
                            </p>
                            <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                Mock
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
                            <p className="text-lg font-black text-indigo-700">
                                {pyqTestCount}
                            </p>
                            <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                PYQ
                            </p>
                        </div>
                    </div>
                </section>

                {!token.trim() ? (
                    <section className="flex flex-col gap-4 rounded-3xl border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-black text-blue-950">
                                Sign in to access your practice workspace
                            </p>
                            <p className="mt-1 text-sm text-blue-800">
                                Your assigned tests, purchases and attempt history are
                                available after student login.
                            </p>
                        </div>

                        <Link
                            href="/student/login"
                            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-bold text-white transition hover:bg-blue-800"
                        >
                            Student Login
                        </Link>
                    </section>
                ) : null}

                {(() => {
                    const resumeCandidate = mockTests.find(
                        (mockTest) =>
                            mockTest.studentAttemptSummary.primaryAction ===
                            "resume"
                    );

                    if (!resumeCandidate) {
                        return null;
                    }

                    const resumeSummary =
                        resumeCandidate.studentAttemptSummary;
                    const isResumeLoading =
                        actionLoadingMockTestId === resumeCandidate._id;

                    return (
                        <section className="overflow-hidden rounded-[28px] bg-[#06132f] text-white shadow-sm">
                            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-blue-500/15 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-blue-200 ring-1 ring-blue-300/20">
                                            Continue Practice
                                        </span>

                                        <span className="text-[10px] font-bold text-slate-400">
                                            {resumeCandidate.testType === "pyq"
                                                ? "Previous Year Paper"
                                                : "Mock Test"}
                                        </span>
                                    </div>

                                    <h2 className="mt-3 text-xl font-black tracking-tight sm:text-2xl">
                                        {resumeCandidate.title}
                                    </h2>

                                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-300">
                                        <span>
                                            {resumeCandidate.examPattern
                                                ?.totalDurationMinutes || "-"}{" "}
                                            min
                                        </span>

                                        <span>
                                            Attempt #
                                            {resumeSummary.latestAttemptNumber ||
                                                resumeSummary.attemptsUsed ||
                                                1}
                                        </span>

                                        <span>
                                            {resumeSummary.attemptsRemaining} attempt
                                            {resumeSummary.attemptsRemaining === 1
                                                ? ""
                                                : "s"}{" "}
                                            remaining
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        handlePrimaryAction(resumeCandidate)
                                    }
                                    disabled={isResumeLoading}
                                    className="min-h-12 rounded-2xl bg-blue-500 px-6 text-sm font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-600"
                                >
                                    {isResumeLoading
                                        ? "Opening..."
                                        : "Resume Test →"}
                                </button>
                            </div>
                        </section>
                    );
                })()}

                <section>
                    <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">
                                Premium Access
                            </p>

                            <h2 className="mt-1 text-2xl font-black tracking-tight">
                                Premium Test Packs
                            </h2>

                            <p className="mt-1 max-w-2xl text-sm text-slate-600">
                                Unlock curated test collections with verified access
                                linked to your student account.
                            </p>
                        </div>

                        {paymentPackages.length > 0 ? (
                            <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 sm:inline-flex">
                                {paymentPackages.length}{" "}
                                {paymentPackages.length === 1 ? "pack" : "packs"}
                            </span>
                        ) : null}
                    </div>

                    {!token.trim() ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                            Sign in to view test packs available for your account.
                        </div>
                    ) : isLoadingPackages ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {[0, 1].map((item) => (
                                <div
                                    key={item}
                                    className="h-56 animate-pulse rounded-3xl border border-slate-200 bg-white"
                                />
                            ))}
                        </div>
                    ) : paymentPackages.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                            No premium test pack is available right now.
                        </div>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {paymentPackages.map((paymentPackage) => {
                                const hasActiveAccess =
                                    isPaymentPackageAccessActive(
                                        paymentPackage
                                    );

                                return (
                                    <article
                                        key={paymentPackage._id}
                                        className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                                    >
                                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-600 via-teal-500 to-amber-400" />

                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-800 ring-1 ring-amber-200">
                                                        {formatPrice(
                                                            paymentPackage.priceInPaise
                                                        )}
                                                    </span>

                                                    <span className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-black text-teal-800 ring-1 ring-teal-200">
                                                        {
                                                            paymentPackage.validityDays
                                                        }{" "}
                                                        days
                                                    </span>

                                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">
                                                        {
                                                            paymentPackage.includedMockTestCount
                                                        }{" "}
                                                        test
                                                        {paymentPackage.includedMockTestCount ===
                                                        1
                                                            ? ""
                                                            : "s"}
                                                    </span>
                                                </div>

                                                <h3 className="mt-4 text-lg font-black leading-6 text-slate-950">
                                                    {paymentPackage.title}
                                                </h3>
                                            </div>

                                            {hasActiveAccess ? (
                                                <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                                                    Active
                                                </span>
                                            ) : null}
                                        </div>

                                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                                            {paymentPackage.description ||
                                                "Premium mock test package for focused exam preparation."}
                                        </p>

                                        {paymentPackage.includedMockTests.length >
                                        0 ? (
                                            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                                                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                    Included
                                                </p>

                                                <div className="mt-2 space-y-1.5">
                                                    {paymentPackage.includedMockTests
                                                        .slice(0, 3)
                                                        .map((includedTest) => (
                                                            <p
                                                                key={
                                                                    includedTest._id
                                                                }
                                                                className="truncate text-xs font-semibold text-slate-700"
                                                            >
                                                                •{" "}
                                                                {includedTest.title ||
                                                                    includedTest.slug ||
                                                                    "Mock Test"}
                                                            </p>
                                                        ))}

                                                    {paymentPackage
                                                        .includedMockTests
                                                        .length > 3 ? (
                                                        <p className="text-xs font-bold text-teal-700">
                                                            +
                                                            {paymentPackage
                                                                .includedMockTests
                                                                .length - 3}{" "}
                                                            more tests
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}

                                        <button
                                            type="button"
                                            onClick={() =>
                                                void handleBuyPaymentPackage(
                                                    paymentPackage
                                                )
                                            }
                                            disabled={
                                                checkoutPackageId ===
                                                    paymentPackage._id ||
                                                hasActiveAccess
                                            }
                                            className={
                                                "mt-5 min-h-11 w-full rounded-xl px-5 text-sm font-black transition disabled:cursor-not-allowed " +
                                                (hasActiveAccess
                                                    ? "bg-emerald-600 text-white disabled:bg-emerald-600"
                                                    : "bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-400")
                                            }
                                        >
                                            {hasActiveAccess
                                                ? "Access Active"
                                                : checkoutPackageId ===
                                                    paymentPackage._id
                                                  ? "Opening Checkout..."
                                                  : "Unlock Pack"}
                                        </button>

                                        {paymentPackage.entitlement
                                            ?.validUntil ? (
                                            <p className="mt-2 text-center text-[11px] font-semibold text-emerald-700">
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
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="border-t border-slate-200 pt-7">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                                Test Library
                            </p>

                            <h2 className="mt-1 text-2xl font-black tracking-tight">
                                Choose your next practice
                            </h2>

                            <p className="mt-1 text-sm text-slate-600">
                                Exam-ready tests with clear access, attempt and review
                                status.
                            </p>
                        </div>

                        <span className="text-xs font-bold text-slate-400">
                            {studentCatalogTestCount} total
                        </span>
                    </div>

                    <div
                        role="tablist"
                        aria-label="Test type"
                        className="mt-5 inline-grid w-full grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1 sm:w-auto sm:min-w-[360px]"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTestType === "mock"}
                            onClick={() => setActiveTestType("mock")}
                            className={
                                "min-h-11 rounded-xl px-5 text-sm font-black transition " +
                                (activeTestType === "mock"
                                    ? "bg-slate-950 text-white shadow-sm"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-950")
                            }
                        >
                            Mock Tests
                            <span className="ml-2 text-xs opacity-70">
                                {mockTestCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTestType === "pyq"}
                            onClick={() => setActiveTestType("pyq")}
                            className={
                                "min-h-11 rounded-xl px-5 text-sm font-black transition " +
                                (activeTestType === "pyq"
                                    ? "bg-indigo-950 text-white shadow-sm"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-950")
                            }
                        >
                            PYQs
                            <span className="ml-2 text-xs opacity-70">
                                {pyqTestCount}
                            </span>
                        </button>
                    </div>

                    <div className="mt-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black text-slate-950">
                                {activeTestType === "mock"
                                    ? "Available Mock Tests"
                                    : "Previous Year Question Papers"}
                            </h3>

                            <p className="mt-0.5 text-xs text-slate-500">
                                {visibleTests.length} available
                            </p>
                        </div>
                    </div>

                    {studentCatalogTestCount === 0 ? (
                        <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
                            <p className="font-bold text-slate-700">
                                No tests available yet
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                Published Mock Tests and PYQs will appear here.
                            </p>
                        </div>
                    ) : visibleTests.length === 0 ? (
                        <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
                            <p className="font-bold text-slate-700">
                                Nothing in this section yet
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                Try the other test type.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            {visibleTests.map((mockTest) => {
                                const summary =
                                    mockTest.studentAttemptSummary;
                                const action = summary.primaryAction;
                                const isActionLoading =
                                    actionLoadingMockTestId ===
                                    mockTest._id;

                                const hasLatestAttempt =
                                    Boolean(
                                        summary.latestAttemptNumber
                                    );

                                return (
                                    <article
                                        key={mockTest._id}
                                        className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-6"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">
                                                {mockTest.category?.name ||
                                                    "Other Exam"}
                                            </span>

                                            <span
                                                className={
                                                    "rounded-full px-3 py-1 text-[10px] font-black " +
                                                    (mockTest.testType ===
                                                    "pyq"
                                                        ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                                                        : "bg-blue-50 text-blue-700 ring-1 ring-blue-200")
                                                }
                                            >
                                                {mockTest.testType ===
                                                "pyq"
                                                    ? "PYQ"
                                                    : "Mock Test"}
                                            </span>

                                            <span
                                                className={
                                                    "rounded-full px-3 py-1 text-[10px] font-black " +
                                                    (mockTest.accessType ===
                                                    "paid"
                                                        ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                                                        : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200")
                                                }
                                            >
                                                {mockTest.accessType ===
                                                "paid"
                                                    ? "Premium"
                                                    : mockTest.accessType}
                                            </span>
                                        </div>

                                        <h3 className="mt-4 text-lg font-black leading-6 tracking-tight text-slate-950 sm:text-xl">
                                            {mockTest.title}
                                        </h3>

                                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                                            {mockTest.description ||
                                                "Practice this test under exam-like conditions."}
                                        </p>

                                        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-slate-100 py-4 sm:grid-cols-4">
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                                                    Pattern
                                                </p>
                                                <p className="mt-1 truncate text-xs font-bold text-slate-700">
                                                    {mockTest.examPattern
                                                        ?.name ||
                                                        "Standard"}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                                                    Duration
                                                </p>
                                                <p className="mt-1 text-xs font-bold text-slate-700">
                                                    {mockTest.examPattern
                                                        ?.totalDurationMinutes ||
                                                        "-"}{" "}
                                                    min
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                                                    Attempts
                                                </p>
                                                <p className="mt-1 text-xs font-bold text-slate-700">
                                                    {summary.attemptsUsed}/
                                                    {summary.maxAttempts}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                                                    Remaining
                                                </p>
                                                <p className="mt-1 text-xs font-bold text-slate-700">
                                                    {
                                                        summary.attemptsRemaining
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center gap-2">
                                            {action === "resume" ? (
                                                <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700">
                                                    In progress
                                                </span>
                                            ) : null}

                                            {summary.result
                                                .isResultVisible ? (
                                                <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700">
                                                    Result ready
                                                </span>
                                            ) : null}

                                            {summary.review
                                                .isDetailedReviewAvailable ? (
                                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">
                                                    Detailed review available
                                                </span>
                                            ) : null}

                                            {summary
                                                .isAttemptLimitReached ? (
                                                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">
                                                    Attempt limit reached
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="mt-3 min-h-5 text-xs text-slate-500">
                                            {hasLatestAttempt ? (
                                                <span>
                                                    Latest attempt #
                                                    {
                                                        summary.latestAttemptNumber
                                                    }
                                                    {summary.latestAttemptStatus
                                                        ? ` • ${String(
                                                              summary.latestAttemptStatus
                                                          ).replace(
                                                              /_/g,
                                                              " "
                                                          )}`
                                                        : ""}
                                                </span>
                                            ) : (
                                                <span>
                                                    Ready for your first attempt
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-auto flex flex-wrap gap-2 pt-5">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handlePrimaryAction(
                                                        mockTest
                                                    )
                                                }
                                                disabled={
                                                    action ===
                                                        "limit_reached" ||
                                                    isActionLoading
                                                }
                                                className={`min-h-11 rounded-xl px-5 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:bg-slate-400 ${getActionClassName(
                                                    action
                                                )}`}
                                            >
                                                {isActionLoading
                                                    ? "Please wait..."
                                                    : actionLabels[action]}
                                            </button>

                                            {summary.result
                                                .isResultVisible &&
                                            action !== "view_result" ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openAttemptResult(
                                                            mockTest
                                                        )
                                                    }
                                                    disabled={
                                                        isActionLoading
                                                    }
                                                    className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Result
                                                </button>
                                            ) : null}

                                            {summary.review
                                                .isDetailedReviewAvailable &&
                                            action !== "view_review" ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openAttemptReview(
                                                            mockTest
                                                        )
                                                    }
                                                    disabled={
                                                        isActionLoading
                                                    }
                                                    className="min-h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Review
                                                </button>
                                            ) : null}

                                            {summary.canRetake &&
                                            action !== "retake" ? (
                                                summary.access
                                                    ?.canAttempt !==
                                                false ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void startOrResumeAttempt(
                                                                mockTest,
                                                                "retake"
                                                            )
                                                        }
                                                        disabled={
                                                            isActionLoading
                                                        }
                                                        className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Retake
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            showAccessRequiredMessage(
                                                                mockTest
                                                            )
                                                        }
                                                        disabled={
                                                            isActionLoading
                                                        }
                                                        className={
                                                            summary.access
                                                                ?.reason ===
                                                            "purchase_required"
                                                                ? "min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                                : "min-h-11 rounded-xl border border-slate-300 bg-slate-100 px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                        }
                                                    >
                                                        {summary.access
                                                            ?.reason ===
                                                        "purchase_required"
                                                            ? "Unlock Access"
                                                            : "Assignment Required"}
                                                    </button>
                                                )
                                            ) : null}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </StudentPortalShell>
    );
}

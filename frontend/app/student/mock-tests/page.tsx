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
type StudentAccessFilter = "all" | "accessible" | "free" | "paid";

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
    checkout?: {
        available?: boolean;
    };
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

const EXAM_TYPE_LABELS: Record<string, string> = {
    ssc: "SSC",
    railway: "Railway",
    banking: "Banking",
    upsc: "UPSC",
    state_exam: "State Exams",
    cpct: "CPCT",
    custom: "Other / Unclassified",
};

const getStudentExamGroup = (mockTest: MockTest) => {
    const categoryName =
        mockTest.category?.name?.trim();

    if (categoryName) {
        return {
            key: `category:${
                mockTest.category?._id ||
                mockTest.category?.slug ||
                categoryName
            }`,
            label: categoryName,
            source: "category" as const,
        };
    }

    const examType =
        (mockTest.examPattern?.examType || "custom")
            .trim()
            .toLowerCase();

    return {
        key: `exam-type:${examType || "custom"}`,
        label:
            EXAM_TYPE_LABELS[examType] ||
            EXAM_TYPE_LABELS.custom,
        source: "examType" as const,
    };
};

export default function StudentMockTestsPage() {
    const router = useRouter();
    const [token, setToken] = useState("");
    const [isClientReady, setIsClientReady] = useState(false);
    const [mockTests, setMockTests] = useState<MockTest[]>([]);
    const [activeTestType, setActiveTestType] = useState<StudentTestType>("mock");
    const [paymentPackages, setPaymentPackages] = useState<StudentPaymentPackage[]>([]);
    const [isPaymentCheckoutAvailable, setIsPaymentCheckoutAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingPackages, setIsLoadingPackages] = useState(false);
    const [checkoutPackageId, setCheckoutPackageId] = useState<string | null>(null);
    const [actionLoadingMockTestId, setActionLoadingMockTestId] = useState<
        string | null
    >(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [actionMessage, setActionMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [accessFilter, setAccessFilter] =
        useState<StudentAccessFilter>("all");

    const mockTestCount = mockTests.filter(
        (mockTest) => mockTest.testType === "mock"
    ).length;

    const pyqTestCount = mockTests.filter(
        (mockTest) => mockTest.testType === "pyq"
    ).length;

    const studentCatalogTestCount = mockTestCount + pyqTestCount;

    const inProgressCount = mockTests.filter(
        (mockTest) =>
            mockTest.studentAttemptSummary.latestAttemptStatus === "in_progress"
    ).length;

    const categoryOptions = Array.from(
        new Map(
            mockTests
                .filter(
                    (mockTest) =>
                        mockTest.testType === activeTestType
                )
                .map((mockTest) => {
                    const examGroup =
                        getStudentExamGroup(mockTest);

                    return [
                        examGroup.key,
                        examGroup,
                    ];
                })
        ).values()
    ).sort((left, right) =>
        left.label.localeCompare(right.label)
    );

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const visibleTests = mockTests.filter((mockTest) => {
        if (mockTest.testType !== activeTestType) {
            return false;
        }

        if (
            selectedCategory !== "all" &&
            getStudentExamGroup(mockTest).key !==
                selectedCategory
        ) {
            return false;
        }

        const searchableText = [
            mockTest.title,
            mockTest.description || "",
            mockTest.category?.name || "",
            mockTest.examPattern?.name || "",
            mockTest.examPattern?.examType || "",
            getStudentExamGroup(mockTest).label,
            mockTest.accessType || "",
        ]
            .join(" ")
            .toLowerCase();

        if (
            normalizedSearchQuery &&
            !searchableText.includes(normalizedSearchQuery)
        ) {
            return false;
        }

        const normalizedAccessType =
            (mockTest.accessType || "").trim().toLowerCase();

        if (
            accessFilter === "free" &&
            normalizedAccessType !== "free"
        ) {
            return false;
        }

        if (
            accessFilter === "paid" &&
            normalizedAccessType !== "paid"
        ) {
            return false;
        }

        if (accessFilter === "accessible") {
            const accessReason =
                mockTest.studentAttemptSummary.access?.reason;

            if (
                accessReason === "purchase_required" ||
                accessReason === "assignment_required"
            ) {
                return false;
            }
        }

        return true;
    });

    const sortedVisibleTests = [...visibleTests].sort(
        (left, right) => {
            const leftGroup =
                getStudentExamGroup(left);

            const rightGroup =
                getStudentExamGroup(right);

            const groupComparison =
                leftGroup.label.localeCompare(
                    rightGroup.label
                );

            if (groupComparison !== 0) {
                return groupComparison;
            }

            return left.title.localeCompare(
                right.title
            );
        }
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
            setIsPaymentCheckoutAvailable(false);
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
                setIsPaymentCheckoutAvailable(false);
                setActionMessage("");
                setErrorMessage(INVALID_STUDENT_SESSION_MESSAGE);
                router.push("/student/login");
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load payment packages.");
            }

            setPaymentPackages(Array.isArray(result.data) ? result.data : []);
            setIsPaymentCheckoutAvailable(result.checkout?.available === true);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Something went wrong while loading payment packages.";

            setErrorMessage(message);
            setPaymentPackages([]);
            setIsPaymentCheckoutAvailable(false);
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
    const handleViewPurchasedPackage = (paymentPackage: StudentPaymentPackage) => {
        const includedMockTestIds = [
            ...paymentPackage.includedMockTests.map(
                (includedMockTest) => includedMockTest._id
            ),
            ...(paymentPackage.entitlement?.mockTestIds || []),
        ];

        const targetMockTest = mockTests.find((mockTest) =>
            includedMockTestIds.includes(mockTest._id)
        );

        if (!targetMockTest) {
            setErrorMessage(
                "No included test is currently available in the student catalog. Please refresh and try again."
            );
            return;
        }

        setSearchQuery("");
        setSelectedCategory("all");
        setAccessFilter("all");
        setActiveTestType(targetMockTest.testType === "pyq" ? "pyq" : "mock");

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                document
                    .getElementById(`student-mock-test-${targetMockTest._id}`)
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });
            });
        });
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

        if (!isPaymentCheckoutAvailable) {
            setErrorMessage("");
            setActionMessage(
                "Purchases are temporarily unavailable. Please try again later."
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
            <div className="text-slate-950">
            <div className="mx-auto max-w-6xl">
                <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl md:p-8">
                    <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />

                    <div className="relative">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-2xl">
                                <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">
                                    Practice Centre
                                </p>

                                <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
                                    Mock Tests &amp; PYQs
                                </h1>

                                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
                                    Find the right test quickly, continue unfinished attempts,
                                    review performance and keep your exam preparation moving.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {token.trim() ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void loadMockTests();
                                            void loadPaymentPackages();
                                        }}
                                        disabled={
                                            isLoading ||
                                            isLoadingPackages ||
                                            !isClientReady
                                        }
                                        className="min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                        {isLoading || isLoadingPackages
                                            ? "Refreshing..."
                                            : "Refresh"}
                                    </button>
                                ) : (
                                    <Link
                                        href="/student/login"
                                        className="flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-bold text-slate-950 hover:bg-slate-100"
                                    >
                                        Login
                                    </Link>
                                )}

                                <Link
                                    href="/student/attempts"
                                    className="flex min-h-11 items-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15"
                                >
                                    My Attempts
                                </Link>
                            </div>
                        </div>

                        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {[
                                {
                                    label: "All Tests",
                                    value: studentCatalogTestCount,
                                },
                                {
                                    label: "Mock Tests",
                                    value: mockTestCount,
                                },
                                {
                                    label: "PYQs",
                                    value: pyqTestCount,
                                },
                                {
                                    label: "In Progress",
                                    value: inProgressCount,
                                },
                            ].map((stat) => (
                                <div
                                    key={stat.label}
                                    className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-4 backdrop-blur"
                                >
                                    <p className="text-2xl font-black">
                                        {stat.value}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                                        {stat.label}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {errorMessage ? (
                    <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                        {errorMessage}
                    </div>
                ) : null}

                {actionMessage ? (
                    <div
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-700 shadow-lg"
                    >
                        {actionMessage}
                    </div>
                ) : null}

                <section id="student-test-catalog" className="scroll-mt-24">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                                Practice Tests
                            </p>

                            <h2 className="mt-1 text-2xl font-black tracking-tight">
                                Available Tests
                            </h2>

                            <p className="mt-1 text-sm text-slate-600">
                                Choose a test by exam, access type or test format.
                            </p>
                        </div>

                        <span className="w-fit rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
                            {visibleTests.length} shown
                        </span>
                    </div>

                    <div
                        role="tablist"
                        aria-label="Test type"
                        className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTestType === "mock"}
                            onClick={() => {
                                setActiveTestType("mock");
                                setSelectedCategory("all");
                            }}
                            className={
                                "rounded-xl px-4 py-3 text-sm font-bold transition " +
                                (activeTestType === "mock"
                                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                                    : "text-slate-600 hover:bg-white/70")
                            }
                        >
                            Mock Tests
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                                {mockTestCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTestType === "pyq"}
                            onClick={() => {
                                setActiveTestType("pyq");
                                setSelectedCategory("all");
                            }}
                            className={
                                "rounded-xl px-4 py-3 text-sm font-bold transition " +
                                (activeTestType === "pyq"
                                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                                    : "text-slate-600 hover:bg-white/70")
                            }
                        >
                            PYQ Tests
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                                {pyqTestCount}
                            </span>
                        </button>
                    </div>

                    <div className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:grid-cols-[minmax(0,1fr)_220px_190px_auto]">
                        <label className="block">
                            <span className="sr-only">Search tests</span>
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(event) =>
                                    setSearchQuery(event.target.value)
                                }
                                placeholder="Search test, exam, pattern..."
                                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                            />
                        </label>

                        <label className="block">
                            <span className="sr-only">Exam category</span>
                            <select
                                value={selectedCategory}
                                onChange={(event) =>
                                    setSelectedCategory(event.target.value)
                                }
                                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                            >
                                <option value="all">All Exams</option>
                                {categoryOptions.map((examGroup) => (
                                    <option
                                        key={examGroup.key}
                                        value={examGroup.key}
                                    >
                                        {examGroup.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="sr-only">Access filter</span>
                            <select
                                value={accessFilter}
                                onChange={(event) =>
                                    setAccessFilter(
                                        event.target.value as StudentAccessFilter
                                    )
                                }
                                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                            >
                                <option value="all">All Access</option>
                                <option value="accessible">Accessible</option>
                                <option value="free">Free</option>
                                <option value="paid">Paid</option>
                            </select>
                        </label>

                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setSelectedCategory("all");
                                setAccessFilter("all");
                            }}
                            disabled={
                                !searchQuery &&
                                selectedCategory === "all" &&
                                accessFilter === "all"
                            }
                            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                            Clear
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm">
                            Refreshing your test catalogue...
                        </div>
                    ) : studentCatalogTestCount === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                            <p className="font-bold text-slate-800">
                                No tests are available yet.
                            </p>
                            <p className="mt-2 text-sm text-slate-500">
                                Published Mock Tests and PYQs will appear here automatically.
                            </p>
                        </div>
                    ) : visibleTests.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                            <p className="font-bold text-slate-800">
                                No tests match these filters.
                            </p>
                            <p className="mt-2 text-sm text-slate-500">
                                Try another search, exam category or access filter.
                            </p>

                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery("");
                                    setSelectedCategory("all");
                                    setAccessFilter("all");
                                }}
                                className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                            >
                                Clear Filters
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                            {sortedVisibleTests.map((mockTest, index) => {
                                const summary =
                                    mockTest.studentAttemptSummary;

                                const action =
                                    summary.primaryAction;

                                const isActionLoading =
                                    actionLoadingMockTestId === mockTest._id;

                                const accessReason =
                                    summary.access?.reason;

                                const examGroup =
                                    getStudentExamGroup(mockTest);

                                const previousExamGroup =
                                    index > 0
                                        ? getStudentExamGroup(
                                              sortedVisibleTests[index - 1]
                                          )
                                        : null;

                                const showExamGroupHeader =
                                    !previousExamGroup ||
                                    previousExamGroup.key !==
                                        examGroup.key;

                                const examGroupTestCount =
                                    sortedVisibleTests.filter(
                                        (candidate) =>
                                            getStudentExamGroup(candidate)
                                                .key === examGroup.key
                                    ).length;

                                return (
                                    <div
                                        key={mockTest._id}
                                        className="contents"
                                    >
                                        {showExamGroupHeader ? (
                                            <div className="col-span-full mt-2 flex items-center gap-3">
                                                <p className="shrink-0 text-sm font-black uppercase tracking-[0.14em] text-slate-900">
                                                    {examGroup.label}
                                                </p>

                                                <div className="h-px flex-1 bg-slate-200" />

                                                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                                                    {examGroupTestCount}{" "}
                                                    {examGroupTestCount === 1
                                                        ? "test"
                                                        : "tests"}
                                                </span>
                                            </div>
                                        ) : null}

                                    <article
                                        id={`student-mock-test-${mockTest._id}`}
                                        className="scroll-mt-28 flex h-full flex-col rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">
                                                {mockTest.testType === "pyq"
                                                    ? "PYQ"
                                                    : "Mock Test"}
                                            </span>

                                            <span
                                                className={
                                                    "rounded-full px-2.5 py-1 text-[10px] font-black " +
                                                    ((mockTest.accessType || "")
                                                        .toLowerCase() === "free"
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : "bg-violet-50 text-violet-700")
                                                }
                                            >
                                                {mockTest.accessType}
                                            </span>

                                            {accessReason ? (
                                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
                                                    {accessReason ===
                                                    "purchase_required"
                                                        ? "Locked"
                                                        : "Assigned"}
                                                </span>
                                            ) : null}
                                        </div>

                                        <h3 className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-[15px] font-black leading-5 tracking-tight text-slate-950">
                                            {mockTest.title}
                                        </h3>

                                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
                                            <span>
                                                {mockTest.examPattern
                                                    ?.totalDurationMinutes ||
                                                    "-"}{" "}
                                                min
                                            </span>

                                            <span aria-hidden="true">
                                                •
                                            </span>

                                            <span>
                                                {summary.attemptsUsed}/
                                                {summary.maxAttempts} attempts
                                            </span>
                                        </div>

                                        <div className="mt-3">
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
                                                className={`min-h-9 w-full rounded-lg px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400 ${getActionClassName(
                                                    action
                                                )}`}
                                            >
                                                {isActionLoading
                                                    ? "Please wait..."
                                                    : actionLabels[action]}
                                            </button>
                                        </div>

                                        <details className="group mt-1.5">
                                            <summary className="cursor-pointer list-none rounded-lg py-1.5 text-center text-[11px] font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
                                                <span className="group-open:hidden">
                                                    View details
                                                </span>
                                                <span className="hidden group-open:inline">
                                                    Hide details
                                                </span>
                                            </summary>

                                            <div className="mt-2 border-t border-slate-100 pt-3">
                                                {mockTest.description ? (
                                                    <p className="text-xs leading-5 text-slate-600">
                                                        {
                                                            mockTest.description
                                                        }
                                                    </p>
                                                ) : null}

                                                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                                    <div className="col-span-2">
                                                        <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                                            Pattern
                                                        </dt>
                                                        <dd className="mt-0.5 font-bold text-slate-700">
                                                            {mockTest
                                                                .examPattern
                                                                ?.name ||
                                                                "Not assigned"}
                                                        </dd>
                                                    </div>

                                                    <div>
                                                        <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                                            Remaining
                                                        </dt>
                                                        <dd className="mt-0.5 font-bold text-slate-700">
                                                            {
                                                                summary.attemptsRemaining
                                                            }
                                                        </dd>
                                                    </div>

                                                    <div>
                                                        <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                                            Latest
                                                        </dt>
                                                        <dd className="mt-0.5 font-bold text-slate-700">
                                                            {summary.latestAttemptNumber
                                                                ? `#${summary.latestAttemptNumber} · ${summary.latestAttemptStatus}`
                                                                : "No attempt"}
                                                        </dd>
                                                    </div>
                                                </dl>

                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {summary.result
                                                        .isResultVisible &&
                                                    action !==
                                                        "view_result" ? (
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
                                                            className="min-h-9 flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                                        >
                                                            Result
                                                        </button>
                                                    ) : null}

                                                    {summary.review
                                                        .isDetailedReviewAvailable &&
                                                    action !==
                                                        "view_review" ? (
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
                                                            className="min-h-9 flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
                                                                className="min-h-9 flex-1 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
                                                                className="min-h-9 flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                                                            >
                                                                Access Required
                                                            </button>
                                                        )
                                                    ) : null}
                                                </div>
                                            </div>
                                        </details>
                                    </article>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section
                    id="student-test-packs"
                    className="mt-10 scroll-mt-24 border-t border-slate-200 pt-8"
                >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-700">
                                Test Packs &amp; Access
                            </p>

                            <h2 className="mt-1 text-2xl font-black tracking-tight">
                                Test Packages
                            </h2>

                            <p className="mt-1 max-w-2xl text-sm text-slate-600">
                                {isPaymentCheckoutAvailable
                                    ? "Choose a pack when you need paid access. Your entitlement unlocks only after verified payment."
                                    : "New purchases are temporarily unavailable. Existing purchased access remains available."}
                            </p>
                        </div>

                        <span className="w-fit rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                            {paymentPackages.length} pack(s)
                        </span>
                    </div>

                    {!token.trim() ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                            Login as a student to view paid test packs.
                        </div>
                    ) : isLoadingPackages ? (
                        <div className="rounded-3xl bg-white p-6 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
                            Loading test packs...
                        </div>
                    ) : paymentPackages.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                            No active paid test pack is available right now.
                        </div>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                            {paymentPackages.map((paymentPackage) => {
                                const hasActiveAccess =
                                    isPaymentPackageAccessActive(
                                        paymentPackage
                                    );

                                return (
                                    <article
                                        key={paymentPackage._id}
                                        className="flex h-full flex-col rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">
                                                {formatPrice(
                                                    paymentPackage.priceInPaise
                                                )}
                                            </span>

                                            {hasActiveAccess ? (
                                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                                                    Access Active
                                                </span>
                                            ) : !isPaymentCheckoutAvailable ? (
                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                                                    Purchases Paused
                                                </span>
                                            ) : null}
                                        </div>

                                        <h3 className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-[15px] font-black leading-5 tracking-tight text-slate-950">
                                            {paymentPackage.title}
                                        </h3>

                                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
                                            <span>
                                                {
                                                    paymentPackage.validityDays
                                                }{" "}
                                                days
                                            </span>

                                            <span aria-hidden="true">
                                                •
                                            </span>

                                            <span>
                                                {
                                                    paymentPackage.includedMockTestCount
                                                }{" "}
                                                {paymentPackage.includedMockTestCount ===
                                                1
                                                    ? "test"
                                                    : "tests"}
                                            </span>
                                        </div>

                                        <div className="mt-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (hasActiveAccess) {
                                                        handleViewPurchasedPackage(
                                                            paymentPackage
                                                        );
                                                        return;
                                                    }

                                                    void handleBuyPaymentPackage(
                                                        paymentPackage
                                                    );
                                                }}
                                                disabled={
                                                    !hasActiveAccess &&
                                                    (!isPaymentCheckoutAvailable ||
                                                        checkoutPackageId ===
                                                            paymentPackage._id)
                                                }
                                                className={
                                                    "min-h-9 w-full rounded-lg px-3 text-xs font-black text-white transition disabled:cursor-not-allowed " +
                                                    (hasActiveAccess
                                                        ? "bg-emerald-600 hover:bg-emerald-700"
                                                        : "bg-slate-950 hover:bg-slate-800 disabled:bg-slate-400")
                                                }
                                            >
                                                {hasActiveAccess
                                                    ? paymentPackage.includedMockTestCount ===
                                                      1
                                                        ? "Open Included Test"
                                                        : "View Included Tests"
                                                    : !isPaymentCheckoutAvailable
                                                      ? "Purchases Unavailable"
                                                      : checkoutPackageId ===
                                                          paymentPackage._id
                                                        ? "Opening Checkout..."
                                                        : "Buy Now"}
                                            </button>
                                        </div>

                                        <details className="group mt-1.5">
                                            <summary className="cursor-pointer list-none rounded-lg py-1.5 text-center text-[11px] font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
                                                <span className="group-open:hidden">
                                                    View package details
                                                </span>

                                                <span className="hidden group-open:inline">
                                                    Hide package details
                                                </span>
                                            </summary>

                                            <div className="mt-2 border-t border-slate-100 pt-3">
                                                {paymentPackage.description ? (
                                                    <p className="text-xs leading-5 text-slate-600">
                                                        {
                                                            paymentPackage.description
                                                        }
                                                    </p>
                                                ) : null}

                                                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                                        Included Tests
                                                    </p>

                                                    <ul className="mt-2 space-y-1.5 text-xs font-semibold text-slate-700">
                                                        {paymentPackage.includedMockTests.map(
                                                            (
                                                                includedMockTest
                                                            ) => (
                                                                <li
                                                                    key={
                                                                        includedMockTest._id
                                                                    }
                                                                    className="flex gap-2"
                                                                >
                                                                    <span className="text-blue-600">
                                                                        •
                                                                    </span>

                                                                    <span>
                                                                        {includedMockTest.title ||
                                                                            includedMockTest.slug ||
                                                                            "Mock Test"}
                                                                    </span>
                                                                </li>
                                                            )
                                                        )}
                                                    </ul>
                                                </div>

                                                {paymentPackage.entitlement
                                                    ?.validUntil ? (
                                                    <p className="mt-3 text-center text-[11px] font-bold text-emerald-700">
                                                        Access valid until{" "}
                                                        {new Date(
                                                            paymentPackage
                                                                .entitlement
                                                                .validUntil
                                                        ).toLocaleDateString(
                                                            "en-IN",
                                                            {
                                                                day: "2-digit",
                                                                month: "short",
                                                                year: "numeric",
                                                            }
                                                        )}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </details>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
        </StudentPortalShell>
    );
}

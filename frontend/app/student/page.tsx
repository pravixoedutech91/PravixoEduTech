"use client";

import { secureLogout } from "../../lib/secureLogout";
import Link from "next/link";
import StudentPortalShell from "@/components/student/StudentPortalShell";
import StudentPromotionSlot from "@/components/student/StudentPromotionSlot";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const STUDENT_TOKEN_STORAGE_KEY = "pravixoStudentToken";
const STUDENT_PROFILE_STORAGE_KEY = "pravixoStudentProfile";
const ACTIVE_ATTEMPT_STORAGE_KEY = "pravixoActiveAttempt";
const ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY = "pravixoActiveAttemptPayload";

const INVALID_STUDENT_SESSION_MESSAGE =
    "Your student session has expired or was invalidated. Please login again.";

type StudentProfile = {
    id?: string;
    name?: string;
    mobile?: string;
    email?: string;
    tenantId?: string;
    role?: string;
};

type PrimaryAction =
    | "start"
    | "resume"
    | "view_result"
    | "view_review"
    | "retake"
    | "limit_reached"
    | "purchase_required"
    | "assignment_required";

type DashboardMockTest = {
    _id: string;
    title: string;
    slug?: string;
    testType?: string;
    accessType?: string;
    examPattern?: {
        name?: string;
        examType?: string;
        totalDurationMinutes?: number;
    } | null;
    studentAttemptSummary?: {
        maxAttempts?: number;
        attemptsUsed?: number;
        attemptsRemaining?: number;
        latestAttemptId?: string | null;
        latestAttemptNumber?: number | null;
        latestAttemptStatus?: string | null;
        primaryAction?: PrimaryAction;
        access?: {
            canAttempt?: boolean;
            reason?: "purchase_required" | "assignment_required" | null;
        };
        result?: {
            attemptId?: string | null;
            isResultVisible?: boolean;
        };
        review?: {
            attemptId?: string | null;
            isDetailedReviewAvailable?: boolean;
        };
    };
};

type MockTestsResponse = {
    success: boolean;
    count?: number;
    data?: DashboardMockTest[];
    message?: string;
};

type ScoreSummary = {
    totalQuestions?: number;
    attemptedQuestions?: number;
    correctAnswers?: number;
    wrongAnswers?: number;
    skippedQuestions?: number;
    score?: number;
    maxScore?: number;
    percentage?: number;
    accuracy?: number;
};

type AttemptHistoryItem = {
    attemptId: string;
    mockTestId?: string | null;
    title?: string | null;
    attemptNumber?: number | null;
    status: string;
    startedAt?: string | null;
    submittedAt?: string | null;
    expiresAt?: string | null;
    scoreSummary?: ScoreSummary;
    result?: {
        isResultVisible?: boolean;
    };
    review?: {
        isDetailedReviewAvailable?: boolean;
        detailedReviewExpiresAt?: string | null;
    };
};

type AttemptsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    total?: number;
    attempts?: AttemptHistoryItem[];
};

type IconName =
    | "home"
    | "book"
    | "test"
    | "clock"
    | "compass"
    | "grid"
    | "search"
    | "spark"
    | "user"
    | "arrow"
    | "chart"
    | "course";

type IconProps = {
    name: IconName;
    className?: string;
};

function Icon({ name, className = "h-5 w-5" }: IconProps) {
    const commonProps = {
        "aria-hidden": true,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        className,
    };

    if (name === "home") {
        return (
            <svg {...commonProps}>
                <path d="M3 10.8 12 3l9 7.8" />
                <path d="M5.5 9.8V21h13V9.8" />
                <path d="M9.5 21v-6h5v6" />
            </svg>
        );
    }

    if (name === "book" || name === "course") {
        return (
            <svg {...commonProps}>
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
                <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" />
            </svg>
        );
    }

    if (name === "test") {
        return (
            <svg {...commonProps}>
                <path d="M8 4h8" />
                <path d="M9 2h6v4H9z" />
                <path d="M6 4h12a2 2 0 0 1 2 2v15H4V6a2 2 0 0 1 2-2Z" />
                <path d="m8 12 2 2 4-5" />
                <path d="M8 18h8" />
            </svg>
        );
    }

    if (name === "clock") {
        return (
            <svg {...commonProps}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.5 2" />
            </svg>
        );
    }

    if (name === "compass") {
        return (
            <svg {...commonProps}>
                <circle cx="12" cy="12" r="9" />
                <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
            </svg>
        );
    }

    if (name === "grid") {
        return (
            <svg {...commonProps}>
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" />
                <rect x="14" y="14" width="7" height="7" rx="2" />
            </svg>
        );
    }

    if (name === "search") {
        return (
            <svg {...commonProps}>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
            </svg>
        );
    }

    if (name === "spark") {
        return (
            <svg {...commonProps}>
                <path d="m12 2 1.4 5.6L19 9l-5.6 1.4L12 16l-1.4-5.6L5 9l5.6-1.4L12 2Z" />
                <path d="m19 15 .8 3.2L23 19l-3.2.8L19 23l-.8-3.2L15 19l3.2-.8L19 15Z" />
            </svg>
        );
    }

    if (name === "user") {
        return (
            <svg {...commonProps}>
                <circle cx="12" cy="8" r="4" />
                <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
            </svg>
        );
    }

    if (name === "chart") {
        return (
            <svg {...commonProps}>
                <path d="M4 20V10" />
                <path d="M10 20V4" />
                <path d="M16 20v-7" />
                <path d="M22 20V7" />
            </svg>
        );
    }

    return (
        <svg {...commonProps} strokeWidth={2}>
            <path d="M5 12h14" />
            <path d="m14 7 5 5-5 5" />
        </svg>
    );
}

function clearStudentSessionStorage() {
    window.localStorage.removeItem(STUDENT_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STUDENT_PROFILE_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY);
}

function isInvalidStudentSessionResponse(
    response: Response,
    message?: string
) {
    const normalizedMessage = (message || "").toLowerCase();

    return (
        response.status === 401 ||
        response.status === 403 ||
        normalizedMessage.includes("jwt expired") ||
        normalizedMessage.includes("invalid token") ||
        normalizedMessage.includes("not authorized") ||
        normalizedMessage.includes("session invalid")
    );
}

async function fetchJson<T>(url: string, token: string) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
    });

    const body = (await response.json()) as T;

    return { response, body };
}

function getFirstName(name?: string) {
    const cleanName = (name || "").trim();

    return cleanName ? cleanName.split(/\s+/)[0] : "Student";
}


function getNumericValue(value?: number | null) {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : null;
}

function formatMetric(value?: number | null, suffix = "") {
    const numericValue = getNumericValue(value);

    if (numericValue === null) {
        return "—";
    }

    return `${Math.round(numericValue * 100) / 100}${suffix}`;
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "—";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return "—";
    }

    return parsed.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function formatStatus(status?: string) {
    if (!status) {
        return "Unknown";
    }

    return status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getStatusClassName(status?: string) {
    if (status === "submitted") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (status === "in_progress") {
        return "border-blue-200 bg-blue-50 text-blue-700";
    }

    if (status === "expired") {
        return "border-amber-200 bg-amber-50 text-amber-700";
    }

    return "border-slate-200 bg-slate-100 text-slate-600";
}

const learnLinks = [
    {
        href: "/study-notes",
        label: "Study Notes",
        description: "Focused revision",
        icon: "book" as IconName,
    },
    {
        href: "/current-affairs",
        label: "Current Affairs",
        description: "Daily exam awareness",
        icon: "spark" as IconName,
    },
];


const exploreLinks = [
    {
        href: "/exams",
        label: "Exams",
        description: "Exam-wise preparation",
        icon: "compass" as IconName,
    },
    {
        href: "/vacancies",
        label: "Vacancies",
        description: "Latest opportunities",
        icon: "grid" as IconName,
    },
    {
        href: "/syllabus",
        label: "Syllabus",
        description: "Plan what to study",
        icon: "book" as IconName,
    },
];

export default function StudentDashboardPage() {
    const router = useRouter();

    const [token, setToken] = useState("");
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [mockTests, setMockTests] = useState<DashboardMockTest[]>([]);
    const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
    const [attemptTotal, setAttemptTotal] = useState(0);

    const [isClientReady, setIsClientReady] = useState(false);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const cleanToken = useMemo(() => token.trim(), [token]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const storedToken =
                window.localStorage.getItem(STUDENT_TOKEN_STORAGE_KEY) || "";

            const storedProfile =
                window.localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY) || "";

            const normalizedToken = storedToken.trim();

            if (!normalizedToken) {
                setIsClientReady(true);
                router.replace("/student/login");
                return;
            }

            if (storedProfile) {
                try {
                    const parsedProfile = JSON.parse(
                        storedProfile
                    ) as StudentProfile;

                    if (
                        parsedProfile.role &&
                        parsedProfile.role !== "student"
                    ) {
                        clearStudentSessionStorage();
                        setIsClientReady(true);
                        router.replace("/student/login");
                        return;
                    }

                    setProfile(parsedProfile);
                } catch {
                    window.localStorage.removeItem(
                        STUDENT_PROFILE_STORAGE_KEY
                    );
                }
            }

            setToken(normalizedToken);
            setIsClientReady(true);
        }, 0);

        return () => window.clearTimeout(timer);
    }, [router]);

    const handleInvalidSession = useCallback(() => {
        clearStudentSessionStorage();
        setToken("");
        setProfile(null);
        setMockTests([]);
        setAttempts([]);
        setAttemptTotal(0);
        setErrorMessage(INVALID_STUDENT_SESSION_MESSAGE);
        router.replace("/student/login");
    }, [router]);

    const loadDashboard = useCallback(
        async (silent = false) => {
            if (!cleanToken) {
                return;
            }

            if (silent) {
                setIsSyncing(true);
            } else {
                setIsInitialLoading(true);
            }

            setErrorMessage("");

            const results = await Promise.allSettled([
                fetchJson<MockTestsResponse>(
                    `${API_BASE_URL}/api/student/mock-tests`,
                    cleanToken
                ),
                fetchJson<AttemptsResponse>(
                    `${API_BASE_URL}/api/student/mock-tests/my-attempts?limit=20`,
                    cleanToken
                ),
            ]);

            const messages: string[] = [];

            try {
                const mockTestsResult = results[0];

                if (mockTestsResult.status === "fulfilled") {
                    const { response, body } = mockTestsResult.value;

                    if (
                        isInvalidStudentSessionResponse(
                            response,
                            body.message
                        )
                    ) {
                        handleInvalidSession();
                        return;
                    }

                    if (response.ok && body.success) {
                        setMockTests(
                            Array.isArray(body.data) ? body.data : []
                        );
                    } else {
                        messages.push(
                            body.message || "Unable to update mock tests."
                        );
                    }
                } else {
                    messages.push(
                        "Mock test information could not be refreshed."
                    );
                }

                const attemptsResult = results[1];

                if (attemptsResult.status === "fulfilled") {
                    const { response, body } = attemptsResult.value;

                    if (
                        isInvalidStudentSessionResponse(
                            response,
                            body.message
                        )
                    ) {
                        handleInvalidSession();
                        return;
                    }

                    if (response.ok && body.success) {
                        const nextAttempts = Array.isArray(body.attempts)
                            ? body.attempts
                            : [];

                        setAttempts(nextAttempts);
                        setAttemptTotal(
                            Number.isFinite(Number(body.total))
                                ? Number(body.total)
                                : Number(body.count) || nextAttempts.length
                        );
                    } else {
                        messages.push(
                            body.message ||
                                "Unable to update recent activity."
                        );
                    }
                } else {
                    messages.push(
                        "Recent activity could not be refreshed."
                    );
                }

                setErrorMessage(messages.join(" "));
                setHasLoadedOnce(true);
            } finally {
                setIsInitialLoading(false);
                setIsSyncing(false);
            }
        },
        [cleanToken, handleInvalidSession]
    );

    useEffect(() => {
        if (!isClientReady || !cleanToken) {
            return;
        }

        const timer = window.setTimeout(() => {
            void loadDashboard(false);
        }, 0);

        return () => window.clearTimeout(timer);
    }, [cleanToken, isClientReady, loadDashboard]);

    useEffect(() => {
        if (!isClientReady || !cleanToken || !hasLoadedOnce) {
            return;
        }

        const handlePageShow = () => {
            void loadDashboard(true);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void loadDashboard(true);
            }
        };

        window.addEventListener("pageshow", handlePageShow);
        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        return () => {
            window.removeEventListener(
                "pageshow",
                handlePageShow
            );
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        };
    }, [cleanToken, hasLoadedOnce, isClientReady, loadDashboard]);

    const resumeCandidate = useMemo(() => {
        const mockTestWithResume = mockTests.find(
            (mockTest) =>
                mockTest.studentAttemptSummary?.primaryAction === "resume" &&
                Boolean(
                    mockTest.studentAttemptSummary.latestAttemptId
                )
        );

        if (
            mockTestWithResume &&
            mockTestWithResume.studentAttemptSummary?.latestAttemptId
        ) {
            return {
                attemptId:
                    mockTestWithResume.studentAttemptSummary
                        .latestAttemptId,
                title: mockTestWithResume.title,
                attemptNumber:
                    mockTestWithResume.studentAttemptSummary
                        .latestAttemptNumber,
            };
        }

        const attemptWithResume = attempts.find(
            (attempt) => attempt.status === "in_progress"
        );

        if (!attemptWithResume) {
            return null;
        }

        return {
            attemptId: attemptWithResume.attemptId,
            title: attemptWithResume.title || "Active Test",
            attemptNumber: attemptWithResume.attemptNumber,
        };
    }, [attempts, mockTests]);

    const submittedAttempts = useMemo(
        () =>
            attempts.filter(
                (attempt) => attempt.status === "submitted"
            ),
        [attempts]
    );

    const latestSubmittedAttempt = useMemo(() => {
        return [...submittedAttempts].sort((first, second) => {
            const firstTime = first.submittedAt
                ? new Date(first.submittedAt).getTime()
                : 0;

            const secondTime = second.submittedAt
                ? new Date(second.submittedAt).getTime()
                : 0;

            return secondTime - firstTime;
        })[0];
    }, [submittedAttempts]);

    const averageAccuracy = useMemo(() => {
        const accuracyValues = submittedAttempts
            .map((attempt) =>
                getNumericValue(attempt.scoreSummary?.accuracy)
            )
            .filter(
                (value): value is number => value !== null
            );

        if (accuracyValues.length === 0) {
            return null;
        }

        return (
            accuracyValues.reduce(
                (total, value) => total + value,
                0
            ) / accuracyValues.length
        );
    }, [submittedAttempts]);

    const accessibleTestCount = useMemo(
        () =>
            mockTests.filter(
                (mockTest) =>
                    mockTest.studentAttemptSummary?.access
                        ?.canAttempt !== false
            ).length,
        [mockTests]
    );

    const latestAccuracy = getNumericValue(
        latestSubmittedAttempt?.scoreSummary?.accuracy
    );

    const latestScore = getNumericValue(
        latestSubmittedAttempt?.scoreSummary?.score
    );

    const latestMaxScore = getNumericValue(
        latestSubmittedAttempt?.scoreSummary?.maxScore
    );

    const handleLogout = async () => {
        const shouldLogout = window.confirm(
            "Are you sure you want to logout? Your saved student session will be cleared."
        );

        if (!shouldLogout) {
            return;
        }

        const logoutResult = await secureLogout(token);

        if (!logoutResult.shouldClearLocalSession) {
            setErrorMessage(
                "Secure logout could not be confirmed. Please check your connection and try again."
            );
            return;
        }

        clearStudentSessionStorage();
        setToken("");
        setProfile(null);
        setMockTests([]);
        setAttempts([]);
        setAttemptTotal(0);

        router.replace("/student/login");
    };

    if (!isClientReady) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-5">
                <div className="text-center text-white">
                    <div className="mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-blue-600 text-lg font-black">
                        P
                    </div>

                    <p className="mt-4 text-sm font-medium text-slate-400">
                        Opening your Pravixo workspace...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <StudentPortalShell
            profile={profile}
            isSyncing={isSyncing}
            onLogout={handleLogout}
        >
            <style>{`
                @keyframes pravixoSnowFall {
                    0% { transform: translate3d(0, -18px, 0); opacity: 0; }
                    12% { opacity: 0.72; }
                    88% { opacity: 0.55; }
                    100% { transform: translate3d(14px, 150px, 0); opacity: 0; }
                }

                @keyframes pravixoSnowDrift {
                    0%, 100% { transform: translateX(0); }
                    50% { transform: translateX(5px); }
                }

                .pravixo-snowflake {
                    animation-name: pravixoSnowFall, pravixoSnowDrift;
                    animation-iteration-count: infinite;
                    animation-timing-function: linear, ease-in-out;
                    pointer-events: none;
                    will-change: transform, opacity;
                }

                @media (prefers-reduced-motion: reduce) {
                    .pravixo-snowflake {
                        animation: none !important;
                        opacity: 0.35;
                    }
                }
            `}</style>
                    {errorMessage ? (
                        <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-amber-800">
                                {errorMessage}
                            </p>

                            <button
                                type="button"
                                onClick={() =>
                                    void loadDashboard(false)
                                }
                                className="self-start text-sm font-black text-amber-800 underline underline-offset-4 sm:self-auto"
                            >
                                Retry
                            </button>
                        </section>
                    ) : null}

                                        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:gap-3 lg:items-start xl:grid-cols-[minmax(0,1fr)_220px] xl:gap-4">
                        <div className="min-w-0">
                        <article className="group relative overflow-hidden rounded-[1.45rem] border border-blue-100/90 bg-gradient-to-br from-[#f7fbff] via-[#e8f5ff] to-[#ccecff] px-5 py-4 text-slate-950 shadow-[0_18px_50px_-28px_rgba(37,99,235,0.45)] sm:px-7 sm:py-5 lg:h-[164px] lg:px-5 lg:py-3 xl:h-[180px] xl:px-6 xl:py-4">
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 overflow-hidden"
                            >
                                <div className="absolute -left-16 -top-24 h-56 w-56 rounded-full bg-white/90 blur-3xl" />
                                <div className="absolute right-[12%] top-3 h-24 w-24 rounded-full bg-cyan-100/80 blur-2xl" />
                                <div className="absolute right-[31%] top-7 h-8 w-28 rounded-full bg-white/45 blur-md" />
                                <div className="absolute right-[7%] top-16 h-7 w-36 rounded-full bg-white/35 blur-md" />

                                <svg
                                    viewBox="0 0 760 320"
                                    className="absolute bottom-0 right-0 h-full w-[82%] opacity-45 sm:w-[69%] sm:opacity-100 lg:bottom-auto lg:right-0 lg:top-[24px] lg:h-[140px] lg:w-[54%] xl:top-[29px] xl:h-[151px] xl:w-[57%]"
                                    preserveAspectRatio="xMaxYMax meet"
                                >
                                    <defs>
                                        <linearGradient
                                            id="pravixoSkyMountainBack"
                                            x1="0"
                                            y1="0"
                                            x2="1"
                                            y2="1"
                                        >
                                            <stop offset="0%" stopColor="#dbeafe" />
                                            <stop offset="100%" stopColor="#7dd3fc" />
                                        </linearGradient>

                                        <linearGradient
                                            id="pravixoMountainMid"
                                            x1="0"
                                            y1="0"
                                            x2="0.9"
                                            y2="1"
                                        >
                                            <stop offset="0%" stopColor="#60a5fa" />
                                            <stop offset="100%" stopColor="#2563eb" />
                                        </linearGradient>

                                        <linearGradient
                                            id="pravixoMountainFront"
                                            x1="0"
                                            y1="0"
                                            x2="1"
                                            y2="1"
                                        >
                                            <stop offset="0%" stopColor="#2563eb" />
                                            <stop offset="55%" stopColor="#1d4ed8" />
                                            <stop offset="100%" stopColor="#12367d" />
                                        </linearGradient>

                                        <linearGradient
                                            id="pravixoSnowShade"
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop offset="0%" stopColor="#ffffff" />
                                            <stop offset="100%" stopColor="#dbeafe" />
                                        </linearGradient>
                                    </defs>

                                    <path
                                        d="M10 320 L150 194 L210 235 L300 138 L380 220 L466 144 L610 320 Z"
                                        fill="url(#pravixoSkyMountainBack)"
                                        opacity="0.62"
                                    />

                                    <path
                                        d="M120 320 L290 126 L363 207 L447 105 L650 320 Z"
                                        fill="url(#pravixoMountainMid)"
                                        opacity="0.82"
                                    />

                                    <path
                                        d="M245 320 L474 44 L720 320 Z"
                                        fill="url(#pravixoMountainFront)"
                                    />

                                    <path
                                        d="M474 44 L400 132 L433 117 L461 145 L481 112 L504 136 L535 119 Z"
                                        fill="url(#pravixoSnowShade)"
                                    />

                                    <path
                                        d="M447 105 L402 158 L424 150 L444 171 L458 151 L479 166 Z"
                                        fill="#eff6ff"
                                        opacity="0.96"
                                    />

                                    <path
                                        d="M290 126 L253 170 L274 163 L291 181 L309 162 L326 176 Z"
                                        fill="#f8fafc"
                                        opacity="0.94"
                                    />





                                    <path
                                        d="M130 320 C220 284 294 288 373 320 Z"
                                        fill="#e0f2fe"
                                        opacity="0.84"
                                    />

                                    <path
                                        d="M415 320 C505 281 600 283 733 320 Z"
                                        fill="#dbeafe"
                                        opacity="0.8"
                                    />

                                    <g fill="#0f3f72" opacity="0.75">
                                        <path d="M430 320 L445 268 L460 320 Z" />
                                        <path d="M454 320 L470 258 L486 320 Z" />
                                        <path d="M495 320 L511 264 L528 320 Z" />
                                        <path d="M535 320 L551 250 L568 320 Z" />
                                        <path d="M578 320 L596 260 L614 320 Z" />
                                        <path d="M620 320 L636 270 L652 320 Z" />
                                    </g>

                                    <g fill="#ffffff">
                                        <circle cx="548" cy="54" r="2.5" className="animate-pulse" />
                                        <circle cx="610" cy="84" r="1.8" className="animate-pulse" />
                                        <circle cx="668" cy="48" r="2" className="animate-pulse" />
                                    </g>
                                </svg>

                                <span
                                    className="pravixo-snowflake absolute top-0 h-2 w-2 rounded-full bg-white shadow-[0_0_7px_rgba(255,255,255,1)] motion-reduce:hidden"
                                    style={{
                                        left: "49%",
                                        animationDelay: "0s",
                                        animationDuration: "8.2s, 3.2s",
                                    }}
                                />

                                <span
                                    className="pravixo-snowflake absolute top-0 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.95)] motion-reduce:hidden"
                                    style={{
                                        left: "55%",
                                        animationDelay: "1.4s",
                                        animationDuration: "9.1s, 3.8s",
                                    }}
                                />

                                <span
                                    className="pravixo-snowflake absolute top-0 h-2.5 w-2.5 rounded-full bg-white/95 shadow-[0_0_8px_rgba(255,255,255,0.95)] motion-reduce:hidden"
                                    style={{
                                        left: "61%",
                                        animationDelay: "3s",
                                        animationDuration: "10.4s, 4.1s",
                                    }}
                                />

                                <span
                                    className="pravixo-snowflake absolute top-0 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.95)] motion-reduce:hidden"
                                    style={{
                                        left: "67%",
                                        animationDelay: "0.8s",
                                        animationDuration: "8.7s, 3.4s",
                                    }}
                                />

                                <span
                                    className="pravixo-snowflake absolute top-0 h-2 w-2 rounded-full bg-white shadow-[0_0_7px_rgba(255,255,255,1)] motion-reduce:hidden"
                                    style={{
                                        left: "72%",
                                        animationDelay: "4.2s",
                                        animationDuration: "10.8s, 4.5s",
                                    }}
                                />

                                <span
                                    className="pravixo-snowflake absolute top-0 h-1 w-1 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,1)] motion-reduce:hidden"
                                    style={{
                                        left: "77%",
                                        animationDelay: "2.1s",
                                        animationDuration: "8.4s, 3.5s",
                                    }}
                                />

                                <span
                                    className="pravixo-snowflake absolute top-0 h-2.5 w-2.5 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.95)] motion-reduce:hidden"
                                    style={{
                                        left: "82%",
                                        animationDelay: "5s",
                                        animationDuration: "11.2s, 4.8s",
                                    }}
                                />

                                <span
                                    className="pravixo-snowflake absolute top-0 h-1.5 w-1.5 rounded-full bg-white motion-reduce:hidden"
                                    style={{
                                        left: "87%",
                                        animationDelay: "1.1s",
                                        animationDuration: "9.3s, 3.7s",
                                    }}
                                />

                                <span
                                    className="pravixo-snowflake absolute top-0 h-2 w-2 rounded-full bg-white shadow-[0_0_7px_rgba(255,255,255,1)] motion-reduce:hidden"
                                    style={{
                                        left: "92%",
                                        animationDelay: "3.6s",
                                        animationDuration: "10.1s, 4.2s",
                                    }}
                                />
                            </div>

                            <div className="relative z-10 flex min-h-[178px] max-w-full flex-col justify-between sm:min-h-[188px] sm:max-w-[58%] lg:h-full lg:min-h-0 lg:max-w-[66%] xl:max-w-[61%]">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-700">
                                        Your workspace
                                    </p>

                                    <h1 className="mt-2 text-[27px] font-black tracking-tight text-slate-950 sm:text-[34px] lg:text-[25px] lg:leading-[1.08] xl:text-[29px]">
                                        Welcome back,{" "}
                                        <span className="text-blue-700">
                                            {getFirstName(profile?.name)}
                                        </span>
                                    </h1>

                                    <p className="mt-2 max-w-md text-xs font-semibold leading-5 text-slate-600 sm:text-sm lg:mt-1 lg:max-w-[300px] lg:text-[10px] lg:leading-[14px] xl:text-xs xl:leading-4">
                                        Stay consistent. Practice more. You are
                                        one step closer to your goal.
                                    </p>
                                </div>

                                <div className="mt-6 flex flex-wrap gap-2.5 lg:mt-2 lg:flex-nowrap lg:gap-2 xl:mt-3">
                                    {resumeCandidate ? (
                                        <Link
                                            href={`/student/attempts/${resumeCandidate.attemptId}`}
                                            className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 text-xs font-black text-white shadow-md shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 lg:min-h-9 lg:px-3 lg:text-[10px] xl:min-h-10 xl:px-4 xl:text-xs"
                                        >
                                            Resume Test
                                            <Icon
                                                name="arrow"
                                                className="h-3.5 w-3.5"
                                            />
                                        </Link>
                                    ) : (
                                        <Link
                                            href="/student/mock-tests"
                                            className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 text-xs font-black text-white shadow-md shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 lg:min-h-9 lg:px-3 lg:text-[10px] xl:min-h-10 xl:px-4 xl:text-xs"
                                        >
                                            Start Practicing
                                            <Icon
                                                name="arrow"
                                                className="h-3.5 w-3.5"
                                            />
                                        </Link>
                                    )}

                                    <Link
                                        href="/student/mock-tests"
                                        className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-blue-200 bg-white/90 px-4 text-xs font-black text-blue-800 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white lg:min-h-9 lg:px-3 lg:text-[10px] xl:min-h-10 xl:px-4 xl:text-xs"
                                    >
                                        Browse Tests
                                        <Icon
                                            name="arrow"
                                            className="h-3.5 w-3.5"
                                        />
                                    </Link>
                                </div>
                            </div>

                            <p className="absolute right-5 top-3.5 z-10 hidden max-w-[155px] text-right text-[10px] font-bold italic leading-4 text-blue-800/80 md:block xl:right-6 xl:top-4 xl:text-[11px]">
                                Discipline today.
                                <br />
                                Success tomorrow.
                            </p>
                        </article>

                    <section className="mt-3 grid gap-2 sm:grid-cols-3 xl:gap-2.5">
                        <article className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md lg:min-h-[70px] lg:py-2 xl:min-h-[74px] xl:px-3 xl:py-2.5">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                    <Icon
                                        name="test"
                                        className="h-4.5 w-4.5"
                                    />
                                </span>

                                <div className="min-w-0">
                                    <p className="whitespace-nowrap text-[7px] font-black uppercase tracking-[0.12em] xl:text-[8px] text-slate-400">
                                        Test Library
                                    </p>

                                    <p className="mt-0.5 text-lg font-black leading-none text-slate-950 xl:text-xl">
                                        {isInitialLoading && !hasLoadedOnce
                                            ? "—"
                                            : `${mockTests.length} total`}
                                    </p>

                                    {!isInitialLoading || hasLoadedOnce ? (
                                        <p className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                            {accessibleTestCount} available
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </article>

                        <article className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md lg:min-h-[70px] lg:py-2 xl:min-h-[74px] xl:px-3 xl:py-2.5">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                                    <Icon
                                        name="chart"
                                        className="h-4.5 w-4.5"
                                    />
                                </span>

                                <div>
                                    <p className="whitespace-nowrap text-[7px] font-black uppercase tracking-[0.12em] xl:text-[8px] text-slate-400">
                                        Attempts
                                    </p>

                                    <p className="mt-0.5 text-lg font-black leading-none text-slate-950 xl:text-xl">
                                        {isInitialLoading && !hasLoadedOnce
                                            ? "—"
                                            : attemptTotal}
                                    </p>

                                    <p className="mt-1 text-[8px] font-semibold leading-3 text-slate-500 xl:text-[9px]">
                                        Your test activity
                                    </p>
                                </div>
                            </div>
                        </article>

                        <article className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md lg:min-h-[70px] lg:py-2 xl:min-h-[74px] xl:px-3 xl:py-2.5">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                                    <Icon
                                        name="chart"
                                        className="h-4.5 w-4.5"
                                    />
                                </span>

                                <div>
                                    <p className="whitespace-nowrap text-[7px] font-black uppercase tracking-[0.12em] xl:text-[8px] text-slate-400">
                                        Average Accuracy
                                    </p>

                                    <p className="mt-0.5 text-lg font-black leading-none text-slate-950 xl:text-xl">
                                        {averageAccuracy === null
                                            ? "—"
                                            : formatMetric(
                                                  averageAccuracy,
                                                  "%"
                                              )}
                                    </p>

                                    <p className="mt-1 text-[8px] font-semibold leading-3 text-slate-500 xl:text-[9px]">
                                        Based on submitted tests
                                    </p>
                                </div>
                            </div>
                        </article>
                    </section>
                        </div>
                        <div className="space-y-3 lg:w-[180px] xl:w-[220px]">
                        <article className="w-full rounded-[1.15rem] border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600">
                                        Latest result
                                    </p>

                                    <h2 className="mt-1 line-clamp-2 text-sm font-black sm:text-base">
                                        {latestSubmittedAttempt?.title ||
                                            "Your performance"}
                                    </h2>
                                </div>

                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                                    <Icon
                                        name="chart"
                                        className="h-4 w-4"
                                    />
                                </span>
                            </div>

                            {isInitialLoading && !hasLoadedOnce ? (
                                <div className="mt-3 h-14 animate-pulse rounded-xl bg-slate-100" />
                            ) : latestSubmittedAttempt ? (
                                <>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <div className="rounded-xl bg-slate-950 px-3 py-2.5 text-white">
                                            <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                                                Score
                                            </p>

                                            <p className="mt-1 text-lg font-black">
                                                {latestScore === null
                                                    ? "—"
                                                    : latestScore}

                                                {latestMaxScore !== null ? (
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        {" "}
                                                        / {latestMaxScore}
                                                    </span>
                                                ) : null}
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
                                            <p className="text-[8px] font-black uppercase tracking-wider text-emerald-700">
                                                Accuracy
                                            </p>

                                            <p className="mt-1 text-lg font-black text-emerald-800">
                                                {latestAccuracy === null
                                                    ? "—"
                                                    : `${Math.round(
                                                          latestAccuracy * 100
                                                      ) / 100}%`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex gap-2">
                                        {latestSubmittedAttempt.result
                                            ?.isResultVisible !== false ? (
                                            <Link
                                                href={`/student/attempts/${latestSubmittedAttempt.attemptId}/result`}
                                                className="inline-flex min-h-9 items-center rounded-xl bg-slate-950 px-3.5 text-[11px] font-black text-white"
                                            >
                                                View Result
                                            </Link>
                                        ) : null}

                                        {latestSubmittedAttempt.review
                                            ?.isDetailedReviewAvailable ? (
                                            <Link
                                                href={`/student/attempts/${latestSubmittedAttempt.attemptId}/review`}
                                                className="inline-flex min-h-9 items-center rounded-xl border border-slate-300 px-3.5 text-[11px] font-black text-slate-700"
                                            >
                                                Review
                                            </Link>
                                        ) : null}
                                    </div>
                                </>
                            ) : (
                                <p className="mt-2 text-[10.5px] leading-4 text-slate-500 xl:text-xs xl:leading-5">
                                    Complete a test to see performance here.
                                </p>
                            )}
                        </article>

                            <aside
                                aria-label="Pravixo motivation"
                                className="relative hidden h-[88px] overflow-hidden rounded-[1.1rem] border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-indigo-100 px-3 py-2.5 shadow-sm lg:block xl:h-[96px]"
                            >
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black italic leading-4 text-blue-800 xl:text-[11px]">
                                        Small Steps.
                                        <br />
                                        Big Results.
                                    </p>
                                </div>

                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 220 90"
                                    preserveAspectRatio="xMaxYMax meet"
                                    className="absolute bottom-0 right-0 h-[74px] w-[155px] opacity-90 xl:h-[82px] xl:w-[175px]"
                                >
                                    <path
                                        d="M10 90 L72 44 L104 70 L137 34 L210 90 Z"
                                        fill="#bfdbfe"
                                    />
                                    <path
                                        d="M70 90 L139 23 L218 90 Z"
                                        fill="#2563eb"
                                    />
                                    <path
                                        d="M139 23 L119 44 L132 39 L140 49 L150 39 L160 45 Z"
                                        fill="#ffffff"
                                    />

                                    <circle
                                        cx="190"
                                        cy="18"
                                        r="2"
                                        fill="#ffffff"
                                        className="animate-pulse"
                                    />

                                    <circle
                                        cx="174"
                                        cy="30"
                                        r="1.4"
                                        fill="#ffffff"
                                        className="animate-pulse"
                                    />
                                </svg>
                            </aside>
                        </div>                    </section>

                    <div className="mt-4 empty:hidden">
                        <StudentPromotionSlot
                            placement="student_dashboard_primary"
                            token={cleanToken}
                        />
                    </div>


                    <section className="mt-6">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">
                                Core Preparation
                            </p>

                            <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                                Learn. Practice. Progress.
                            </h2>
                        </div>

                        <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                            <article className="group relative overflow-hidden rounded-[1.15rem] border border-indigo-900/50 bg-gradient-to-br from-[#151643] via-[#101537] to-[#080d1f] p-3.5 text-white shadow-[0_14px_32px_-24px_rgba(15,23,42,0.95)] transition hover:-translate-y-0.5 hover:border-indigo-700/60 hover:shadow-md">
                                <div className="absolute -right-10 -top-14 h-32 w-32 rounded-full bg-indigo-500/20 blur-3xl" />

                                <div className="relative flex min-h-[102px] flex-col">
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-indigo-100">
                                            <Icon
                                                name="course"
                                                className="h-4 w-4"
                                            />
                                        </span>

                                        <span className="rounded-full border border-indigo-300/20 bg-indigo-400/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-indigo-200">
                                            Coming Soon
                                        </span>
                                    </div>

                                    <div className="mt-3">
                                        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-indigo-300">
                                            Pravixo Learn
                                        </p>

                                        <h3 className="mt-1 text-lg font-black">
                                            Courses
                                        </h3>

                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">
                                            Structured courses, lessons and
                                            tracked learning journeys.
                                        </p>
                                    </div>

                                    <span className="mt-auto pt-3 text-[11px] font-black text-indigo-200">
                                        LMS-ready learning →
                                    </span>
                                </div>
                            </article>

                            <Link
                                href="/student/mock-tests"
                                className="group relative overflow-hidden rounded-[1.15rem] border border-blue-400/20 bg-gradient-to-br from-[#2563eb] via-[#1d4ed8] to-[#10234f] p-3.5 text-white shadow-[0_14px_32px_-24px_rgba(37,99,235,0.8)] transition hover:-translate-y-0.5 hover:border-blue-300/30 hover:shadow-md"
                            >
                                <div className="absolute -right-10 -top-14 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />

                                <div className="relative flex min-h-[102px] flex-col">
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                                            <Icon
                                                name="test"
                                                className="h-4 w-4"
                                            />
                                        </span>

                                        <span className="rounded-full border border-emerald-300/20 bg-emerald-400/15 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-emerald-200">
                                            Live
                                        </span>
                                    </div>

                                    <div className="mt-3">
                                        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-blue-200">
                                            Pravixo Practice
                                        </p>

                                        <h3 className="mt-1 text-lg font-black">
                                            Mock Tests & PYQs
                                        </h3>

                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-blue-100">
                                            Real exam-style Mock Tests and
                                            Previous Year Question papers.
                                        </p>
                                    </div>

                                    <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                                        <span className="text-[11px] font-black">
                                            Explore Tests →
                                        </span>

                                        <span className="text-right">
                                            <span className="block text-lg font-black">
                                                {isInitialLoading &&
                                                !hasLoadedOnce
                                                    ? "—"
                                                    : accessibleTestCount}
                                            </span>

                                            <span className="block text-[7px] font-black uppercase tracking-wider text-blue-200">
                                                Accessible
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </section>

                    <div className="mt-4 empty:hidden">
                        <StudentPromotionSlot
                            placement="student_dashboard_secondary"
                            token={cleanToken}
                        />
                    </div>

                    <section className="mt-6">
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    Explore Resources
                                </p>

                                <h2 className="mt-1 text-lg font-black tracking-tight">
                                    More ways to prepare
                                </h2>
                            </div>

                            <Link
                                href="/search"
                                className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 sm:text-xs"
                            >
                                Search all
                                <Icon
                                    name="arrow"
                                    className="h-3 w-3"
                                />
                            </Link>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                            {[...learnLinks, ...exploreLinks].map(
                                (item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="group min-h-[82px] rounded-[1rem] border border-slate-200/90 bg-white p-2.5 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.8)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/20 hover:shadow-md"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition group-hover:bg-blue-50 group-hover:text-blue-700">
                                                <Icon
                                                    name={item.icon}
                                                    className="h-4 w-4"
                                                />
                                            </span>

                                            <Icon
                                                name="arrow"
                                                className="h-3 w-3 text-slate-300 group-hover:text-blue-600"
                                            />
                                        </div>

                                        <h3 className="mt-2 text-xs font-black sm:text-sm">
                                            {item.label}
                                        </h3>

                                        <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500 sm:text-xs">
                                            {item.description}
                                        </p>
                                    </Link>
                                )
                            )}
                        </div>
                    </section>
<section className="mt-6 rounded-[1.25rem] border border-slate-200/90 bg-white p-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.8)] sm:p-5">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Recent activity
                                </p>

                                <h2 className="mt-1 text-xl font-black">
                                    Your latest attempts
                                </h2>
                            </div>

                            <Link
                                href="/student/attempts"
                                className="inline-flex items-center gap-1 text-xs font-black text-blue-700 sm:text-sm"
                            >
                                View all
                                <Icon
                                    name="arrow"
                                    className="h-3.5 w-3.5"
                                />
                            </Link>
                        </div>

                        {isInitialLoading && !hasLoadedOnce ? (
                            <div className="mt-5 space-y-3">
                                {[1, 2, 3].map((item) => (
                                    <div
                                        key={item}
                                        className="h-14 animate-pulse rounded-xl bg-slate-100"
                                    />
                                ))}
                            </div>
                        ) : attempts.length === 0 ? (
                            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                                Your test activity will appear here after
                                you start practicing.
                            </div>
                        ) : (
                            <div className="mt-4 divide-y divide-slate-100">
                                {attempts
                                    .slice(0, 3)
                                    .map((attempt) => (
                                        <div
                                            key={attempt.attemptId}
                                            className="flex flex-col gap-2.5 py-3 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="truncate text-sm font-black sm:text-base">
                                                        {attempt.title ||
                                                            "Student Test"}
                                                    </h3>

                                                    <span
                                                        className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${getStatusClassName(
                                                            attempt.status
                                                        )}`}
                                                    >
                                                        {formatStatus(
                                                            attempt.status
                                                        )}
                                                    </span>
                                                </div>

                                                <p className="mt-1 text-xs text-slate-500">
                                                    Attempt #
                                                    {attempt.attemptNumber ||
                                                        "-"}{" "}
                                                    ·{" "}
                                                    {formatDateTime(
                                                        attempt.submittedAt ||
                                                            attempt.startedAt
                                                    )}
                                                </p>
                                            </div>

                                            <div className="flex shrink-0 gap-2">
                                                {attempt.status ===
                                                "in_progress" ? (
                                                    <Link
                                                        href={`/student/attempts/${attempt.attemptId}`}
                                                        className="inline-flex min-h-9 items-center rounded-xl bg-blue-600 px-3.5 text-xs font-black text-white"
                                                    >
                                                        Resume
                                                    </Link>
                                                ) : null}

                                                {attempt.status ===
                                                    "submitted" &&
                                                attempt.result
                                                    ?.isResultVisible !==
                                                    false ? (
                                                    <Link
                                                        href={`/student/attempts/${attempt.attemptId}/result`}
                                                        className="inline-flex min-h-9 items-center rounded-xl border border-slate-300 px-3.5 text-xs font-black text-slate-700"
                                                    >
                                                        Result
                                                    </Link>
                                                ) : null}

                                                {attempt.status ===
                                                    "submitted" &&
                                                attempt.review
                                                    ?.isDetailedReviewAvailable ? (
                                                    <Link
                                                        href={`/student/attempts/${attempt.attemptId}/review`}
                                                        className="inline-flex min-h-9 items-center rounded-xl border border-slate-300 px-3.5 text-xs font-black text-slate-700"
                                                    >
                                                        Review
                                                    </Link>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </section>

        </StudentPortalShell>
    );
}

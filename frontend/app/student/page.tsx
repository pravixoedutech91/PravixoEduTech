"use client";

import Link from "next/link";
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

function getInitial(name?: string) {
    const cleanName = (name || "").trim();

    return cleanName ? cleanName.charAt(0).toUpperCase() : "S";
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

const practiceLinks = [
    {
        href: "/student/mock-tests",
        label: "Mock Tests & PYQs",
        icon: "test" as IconName,
    },
    {
        href: "/student/attempts",
        label: "My Attempts",
        icon: "clock" as IconName,
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

    const handleLogout = () => {
        const shouldLogout = window.confirm(
            "Are you sure you want to logout? Your saved student session will be cleared."
        );

        if (!shouldLogout) {
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
        <div className="min-h-[100dvh] bg-[#f5f7fb] text-slate-950">
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-[#060b1d] text-white lg:flex">
                <div className="flex h-[82px] items-center border-b border-white/8 px-5">
                    <Link
                        href="/student"
                        className="flex min-w-0 items-center gap-3"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 font-black shadow-lg shadow-blue-950/40">
                            P
                        </span>

                        <span className="min-w-0">
                            <span className="block truncate text-[17px] font-black tracking-tight">
                                PravixoEduTech
                            </span>

                            <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-blue-300">
                                Student
                            </span>
                        </span>
                    </Link>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <p className="px-3 text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Workspace
                    </p>

                    <nav className="mt-2">
                        <Link
                            href="/student"
                            className="flex min-h-11 items-center gap-3 rounded-xl bg-white/10 px-3.5 text-sm font-bold text-white ring-1 ring-white/8"
                        >
                            <Icon name="home" />
                            Dashboard
                        </Link>
                    </nav>

                    <p className="mt-6 px-3 text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Learn
                    </p>

                    <nav className="mt-2 space-y-0.5">
                        <div className="flex min-h-11 items-center justify-between rounded-xl px-3.5 text-sm font-semibold text-slate-400">
                            <span className="flex items-center gap-3">
                                <Icon name="course" />
                                Courses
                            </span>

                            <span className="rounded-full bg-blue-500/15 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-blue-300">
                                Soon
                            </span>
                        </div>

                        {learnLinks.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
                            >
                                <Icon name={item.icon} />
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <p className="mt-6 px-3 text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Practice
                    </p>

                    <nav className="mt-2 space-y-0.5">
                        {practiceLinks.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
                            >
                                <Icon name={item.icon} />
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <p className="mt-6 px-3 text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Explore
                    </p>

                    <nav className="mt-2 space-y-0.5">
                        {exploreLinks.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
                            >
                                <Icon name={item.icon} />
                                {item.label}
                            </Link>
                        ))}

                        <Link
                            href="/search"
                            className="flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
                        >
                            <Icon name="search" />
                            Search
                        </Link>
                    </nav>
                </div>

                <div className="border-t border-white/8 p-3">
                    <div className="flex items-center gap-3 rounded-xl px-2 py-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black">
                            {getInitial(profile?.name)}
                        </span>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">
                                {profile?.name || "Student"}
                            </p>

                            <p className="truncate text-[10px] text-slate-500">
                                {profile?.email ||
                                    profile?.mobile ||
                                    "Pravixo learner"}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleLogout}
                            title="Logout"
                            aria-label="Logout"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
                        >
                            <span className="text-lg">↗</span>
                        </button>
                    </div>
                </div>
            </aside>

            <div className="lg:pl-[248px]">
                <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
                    <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                        <Link
                            href="/student"
                            className="flex items-center gap-2.5 lg:hidden"
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black text-white">
                                P
                            </span>

                            <span className="font-black tracking-tight">
                                Pravixo
                            </span>
                        </Link>

                        <Link
                            href="/search"
                            className="hidden min-h-11 w-full max-w-[560px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-500 transition hover:border-blue-300 hover:bg-white sm:flex"
                        >
                            <Icon
                                name="search"
                                className="h-4 w-4"
                            />
                            Search exams, notes, vacancies, current affairs...
                        </Link>

                        <div className="flex items-center gap-2">
                            {isSyncing ? (
                                <span className="hidden items-center gap-2 text-xs font-semibold text-slate-400 sm:flex">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                                    Syncing
                                </span>
                            ) : null}

                            <Link
                                href="/search"
                                aria-label="Search"
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 sm:hidden"
                            >
                                <Icon name="search" />
                            </Link>

                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pr-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-xs font-black text-white">
                                    {getInitial(profile?.name)}
                                </span>

                                <div className="hidden min-w-0 sm:block">
                                    <p className="max-w-[130px] truncate text-xs font-bold">
                                        {profile?.name || "Student"}
                                    </p>

                                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                                        Learner
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">
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

                                        <section className="grid gap-3 lg:grid-cols-[1.18fr_0.82fr]">
                        <article className="relative overflow-hidden rounded-[1.25rem] bg-[#071127] px-5 py-4 text-white shadow-lg shadow-slate-300/30 sm:px-6 sm:py-5">
                            <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-blue-500/15 blur-3xl" />

                            <div className="relative flex min-h-[108px] flex-col justify-between sm:min-h-[116px]">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">
                                        Your workspace
                                    </p>

                                    <h1 className="mt-1.5 text-[22px] font-black tracking-tight sm:text-[27px]">
                                        Welcome back,{" "}
                                        <span className="text-blue-300">
                                            {getFirstName(profile?.name)}
                                        </span>
                                    </h1>

                                    <p className="mt-2 max-w-xl text-xs leading-5 text-slate-300 sm:text-sm">
                                        Continue learning and practice from
                                        one focused workspace.
                                    </p>
                                </div>

                                <div className="mt-4">
                                    {resumeCandidate ? (
                                        <Link
                                            href={`/student/attempts/${resumeCandidate.attemptId}`}
                                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-500 px-4 text-xs font-black text-white transition hover:bg-blue-400"
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
                                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-500 px-4 text-xs font-black text-white transition hover:bg-blue-400"
                                        >
                                            Start Practicing
                                            <Icon
                                                name="arrow"
                                                className="h-3.5 w-3.5"
                                            />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </article>

                        <article className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
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
                                <p className="mt-3 text-xs leading-5 text-slate-500">
                                    Complete a test to see performance here.
                                </p>
                            )}
                        </article>
                    </section>

                    <div className="mt-4 empty:hidden">
                        <StudentPromotionSlot
                            placement="student_dashboard_primary"
                            token={cleanToken}
                        />
                    </div>

                    <section className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
                        <div className="grid grid-cols-3 divide-x divide-slate-100">
                            <div className="pr-3 sm:pr-5">
                                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                                    Tests
                                </p>

                                <p className="mt-1 text-xl font-black">
                                    {isInitialLoading && !hasLoadedOnce
                                        ? "—"
                                        : accessibleTestCount}
                                </p>
                            </div>

                            <div className="px-3 sm:px-5">
                                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                                    Attempts
                                </p>

                                <p className="mt-1 text-xl font-black">
                                    {isInitialLoading && !hasLoadedOnce
                                        ? "—"
                                        : attemptTotal}
                                </p>
                            </div>

                            <div className="pl-3 sm:pl-5">
                                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                                    Accuracy
                                </p>

                                <p className="mt-1 text-xl font-black">
                                    {averageAccuracy === null
                                        ? "—"
                                        : formatMetric(
                                              averageAccuracy,
                                              "%"
                                          )}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="mt-6">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">
                                Core Preparation
                            </p>

                            <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                                Learn. Practice. Progress.
                            </h2>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <article className="relative overflow-hidden rounded-[1.2rem] bg-gradient-to-br from-indigo-950 to-slate-950 p-4 text-white shadow-sm">
                                <div className="absolute -right-10 -top-14 h-32 w-32 rounded-full bg-indigo-500/20 blur-3xl" />

                                <div className="relative flex min-h-[112px] flex-col">
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
                                className="group relative overflow-hidden rounded-[1.2rem] bg-gradient-to-br from-blue-600 via-blue-700 to-slate-950 p-4 text-white shadow-sm transition hover:-translate-y-0.5"
                            >
                                <div className="absolute -right-10 -top-14 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />

                                <div className="relative flex min-h-[112px] flex-col">
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

                        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
                            {[...learnLinks, ...exploreLinks].map(
                                (item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="group min-h-[92px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
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
<section className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
                                        className="h-16 animate-pulse rounded-xl bg-slate-100"
                                    />
                                ))}
                            </div>
                        ) : attempts.length === 0 ? (
                            <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
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
                                            className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
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
                </main>

                <nav
                    aria-label="Student mobile navigation"
                    className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[1.35rem] border border-slate-200 bg-white/95 p-1.5 shadow-2xl shadow-slate-950/20 backdrop-blur-xl lg:hidden"
                >
                    <Link
                        href="/student"
                        className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl bg-slate-950 text-white"
                    >
                        <Icon
                            name="home"
                            className="h-4 w-4"
                        />
                        <span className="text-[9px] font-black">
                            Home
                        </span>
                    </Link>

                    <Link
                        href="/study-notes"
                        className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-slate-500"
                    >
                        <Icon
                            name="book"
                            className="h-4 w-4"
                        />
                        <span className="text-[9px] font-bold">
                            Learn
                        </span>
                    </Link>

                    <Link
                        href="/student/mock-tests"
                        className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-slate-500"
                    >
                        <Icon
                            name="test"
                            className="h-4 w-4"
                        />
                        <span className="text-[9px] font-bold">
                            Tests
                        </span>
                    </Link>

                    <Link
                        href="/exams"
                        className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-slate-500"
                    >
                        <Icon
                            name="compass"
                            className="h-4 w-4"
                        />
                        <span className="text-[9px] font-bold">
                            Explore
                        </span>
                    </Link>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-slate-500"
                    >
                        <Icon
                            name="user"
                            className="h-4 w-4"
                        />
                        <span className="text-[9px] font-bold">
                            Account
                        </span>
                    </button>
                </nav>
            </div>
        </div>
    );
}

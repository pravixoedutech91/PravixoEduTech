"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type StudentPortalProfile = {
    id?: string;
    name?: string;
    email?: string;
    mobile?: string;
    tenantId?: string;
    role?: string;
};

type StudentPortalShellProps = {
    children: ReactNode;
    profile?: StudentPortalProfile | null;
    isSyncing?: boolean;
    onLogout: () => void;
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

function getInitial(name?: string) {
    const cleanName = String(name || "").trim();

    return cleanName
        ? cleanName.charAt(0).toUpperCase()
        : "S";
}

function isActiveStudentRoute(
    pathname: string,
    href: string
) {
    if (href === "/student") {
        return pathname === "/student";
    }

    return (
        pathname === href ||
        pathname.startsWith(`${href}/`)
    );
}

function desktopNavClassName(isActive: boolean) {
    return isActive
        ? "flex min-h-11 items-center gap-3 rounded-xl bg-white/10 px-3.5 text-sm font-bold text-white ring-1 ring-white/8"
        : "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white";
}

function mobileNavClassName(isActive: boolean) {
    return isActive
        ? "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl bg-slate-950 text-white"
        : "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-slate-500";
}

export default function StudentPortalShell({
    children,
    profile,
    isSyncing = false,
    onLogout,
}: StudentPortalShellProps) {
    const pathname = usePathname();

    const isDashboardActive =
        isActiveStudentRoute(pathname, "/student");

    const isTestsActive =
        isActiveStudentRoute(
            pathname,
            "/student/mock-tests"
        );

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
                            className={desktopNavClassName(
                                isDashboardActive
                            )}
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
                        {practiceLinks.map((item) => {
                            const isActive =
                                isActiveStudentRoute(
                                    pathname,
                                    item.href
                                );

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={desktopNavClassName(
                                        isActive
                                    )}
                                >
                                    <Icon name={item.icon} />
                                    {item.label}
                                </Link>
                            );
                        })}
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
                            onClick={onLogout}
                            title="Logout"
                            aria-label="Logout"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
                        >
                            <span
                                aria-hidden="true"
                                className="text-lg"
                            >
                                ↗
                            </span>
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
                    {children}
                </main>

                <nav
                    aria-label="Student mobile navigation"
                    className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[1.35rem] border border-slate-200 bg-white/95 p-1.5 shadow-2xl shadow-slate-950/20 backdrop-blur-xl lg:hidden"
                >
                    <Link
                        href="/student"
                        className={mobileNavClassName(
                            isDashboardActive
                        )}
                    >
                        <Icon
                            name="home"
                            className="h-4 w-4"
                        />

                        <span
                            className={
                                isDashboardActive
                                    ? "text-[9px] font-black"
                                    : "text-[9px] font-bold"
                            }
                        >
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
                        className={mobileNavClassName(
                            isTestsActive
                        )}
                    >
                        <Icon
                            name="test"
                            className="h-4 w-4"
                        />

                        <span
                            className={
                                isTestsActive
                                    ? "text-[9px] font-black"
                                    : "text-[9px] font-bold"
                            }
                        >
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
                        onClick={onLogout}
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

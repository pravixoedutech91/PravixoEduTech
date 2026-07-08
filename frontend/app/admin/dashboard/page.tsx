"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const ADMIN_TOKEN_STORAGE_KEY = "pravixoAdminToken";
const ADMIN_PROFILE_STORAGE_KEY = "pravixoAdminProfile";

const INVALID_ADMIN_SESSION_MESSAGE =
    "Your admin session has expired or was invalidated. Please login again.";

const ALLOWED_ADMIN_ROLES = ["super_admin", "tenant_admin", "content_admin"];

type AdminProfile = {
    id?: string;
    name?: string;
    mobile?: string;
    email?: string;
    tenantId?: string;
    role?: string;
};

type MeResponse = {
    success: boolean;
    message?: string;
    data?: AdminProfile;
};

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role));
};

const getAdminRoleLabel = (role?: string) => {
    if (role === "super_admin") {
        return "Super Admin";
    }

    if (role === "tenant_admin") {
        return "Admin";
    }

    if (role === "content_admin") {
        return "Content Manager";
    }

    return "Admin";
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

export default function AdminDashboardPage() {
    const router = useRouter();

    const [token, setToken] = useState("");
    const [profile, setProfile] = useState<AdminProfile | null>(null);
    const [isClientReady, setIsClientReady] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            const verifyAdminSession = async () => {
                const savedToken =
                    window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

                if (!savedToken) {
                    clearAdminSessionStorage();
                    setToken("");
                    setProfile(null);
                    setMessage("Please login with an admin account.");
                    setIsClientReady(true);
                    return;
                }

                try {
                    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                        headers: {
                            Authorization: `Bearer ${savedToken}`,
                        },
                    });

                    const result = (await response.json()) as MeResponse;

                    if (!response.ok || !result.success || !result.data) {
                        throw new Error(result.message || INVALID_ADMIN_SESSION_MESSAGE);
                    }

                    if (!isAllowedAdminRole(result.data.role)) {
                        throw new Error("Please login with an admin account.");
                    }

                    window.localStorage.setItem(
                        ADMIN_PROFILE_STORAGE_KEY,
                        JSON.stringify(result.data)
                    );

                    setToken(savedToken);
                    setProfile(result.data);
                    setMessage("");
                } catch (error) {
                    clearAdminSessionStorage();
                    setToken("");
                    setProfile(null);
                    setMessage(
                        error instanceof Error
                            ? error.message
                            : INVALID_ADMIN_SESSION_MESSAGE
                    );
                } finally {
                    setIsClientReady(true);
                }
            };

            void verifyAdminSession();
        }, 0);

        return () => window.clearTimeout(timerId);
    }, []);

    const roleLabel = getAdminRoleLabel(profile?.role);

    const handleLogout = () => {
        const shouldLogout = window.confirm(
            "Are you sure you want to logout? Your saved admin session will be cleared."
        );

        if (!shouldLogout) {
            return;
        }

        clearAdminSessionStorage();

        setToken("");
        setProfile(null);
        setMessage("You have been logged out.");

        router.push("/admin/login");
    };

    if (!isClientReady) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
                <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    Loading admin session...
                </div>
            </main>
        );
    }

    if (!token || !profile) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
                <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                        Admin Access
                    </p>

                    <h1 className="mt-3 text-2xl font-bold">
                        Login required
                    </h1>

                    <p className="mt-3 text-sm text-slate-600">
                        {message || "Please login with an admin account."}
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
        <main className="min-h-screen bg-slate-100 text-slate-950">
            <div className="flex min-h-screen flex-col lg:flex-row">
                <aside className="border-b border-slate-200 bg-slate-950 px-5 py-6 text-white lg:w-72 lg:border-b-0 lg:border-r lg:border-slate-800">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200">
                            PravixoEduTech
                        </p>
                        <h2 className="mt-2 text-2xl font-black">Admin Panel</h2>
                        <p className="mt-2 text-xs leading-5 text-slate-300">
                            {profile.name || "Admin"} · {roleLabel}
                        </p>
                    </div>

                    <nav className="mt-8 space-y-6">
                        <div>
                            <p className="px-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                                Main
                            </p>
                            <Link
                                href="/admin/dashboard"
                                className="mt-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950"
                            >
                                Dashboard
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">
                                    Active
                                </span>
                            </Link>
                        </div>

                        <div>
                            <p className="px-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                                Mock-Test
                            </p>

                            <div className="mt-3 space-y-2">
                                {[
                                    "Exam Patterns",
                                    "Question Groups",
                                    "Question Bank",
                                    "Mock Tests",
                                    "Published Versions",
                                ].map((item) => (
                                    ["Exam Patterns", "Question Groups"].includes(item) ? (
                                        <Link
                                            key={item}
                                            href={
                                                item === "Exam Patterns"
                                                    ? "/admin/mock-tests/exam-patterns"
                                                    : "/admin/mock-tests/question-groups"
                                            }
                                            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 hover:bg-slate-800"
                                        >
                                            <span>{item}</span>
                                            <span className="rounded-full bg-blue-950 px-2 py-0.5 text-[11px] text-blue-200">
                                                Open
                                            </span>
                                        </Link>
                                    ) : (
                                        <div
                                            key={item}
                                            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200"
                                        >
                                            <span>{item}</span>
                                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
                                                Coming next
                                            </span>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    </nav>
                </aside>

                <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
                    <div className="mx-auto flex max-w-6xl flex-col gap-6">
                        <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                                        Admin Dashboard
                                    </p>

                                    <h1 className="mt-2 text-3xl font-bold">
                                        Welcome, {profile.name || "Admin"}
                                    </h1>

                                    <p className="mt-2 text-sm text-slate-600">
                                        Logged in as {roleLabel}. Admin session is verified from backend.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
                                >
                                    Logout
                                </button>
                            </div>
                        </header>

                        <section className="grid gap-4 md:grid-cols-3">
                            <div className="min-w-0 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Role
                                </p>
                                <p className="mt-2 break-words text-lg font-bold">
                                    {roleLabel}
                                </p>
                            </div>

                            <div className="min-w-0 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Institute
                                </p>
                                <p className="mt-2 break-words text-lg font-bold">
                                    {profile.tenantId || "-"}
                                </p>
                            </div>

                            <div className="min-w-0 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Email / Mobile
                                </p>
                                <p className="mt-2 break-all text-base font-bold sm:text-lg">
                                    {profile.email || profile.mobile || "-"}
                                </p>
                            </div>
                        </section>

                        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                            <h2 className="text-xl font-bold">
                                T-42B Admin Shell Foundation
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                Admin sidebar shell is now ready. The Mock-Test section
                                will be connected step by step: Exam Patterns, Question
                                Groups, Question Bank, Mock Test Builder, and Published
                                Versions.
                            </p>

                            <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-100">
                                Next step: create protected placeholder routes for the
                                Mock-Test module before adding forms or APIs.
                            </div>
                        </section>
                    </div>
                </section>
            </div>
        </main>
    );
}

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

    const roleLabel = profile?.role ? profile.role.replaceAll("_", " ") : "admin";

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
        <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                                PravixoEduTech Admin
                            </p>

                            <h1 className="mt-2 text-3xl font-bold">
                                Admin Dashboard
                            </h1>

                            <p className="mt-2 text-sm text-slate-600">
                                Logged in as {profile.name || "Admin"} ({roleLabel})
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

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <h2 className="text-xl font-bold">T-42A Admin Session Foundation</h2>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Tenant
                            </p>
                            <p className="mt-1 text-sm font-bold">
                                {profile.tenantId || "-"}
                            </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Email / Mobile
                            </p>
                            <p className="mt-1 text-sm font-bold">
                                {profile.email || profile.mobile || "-"}
                            </p>
                        </div>
                    </div>

                    <p className="mt-5 text-sm leading-6 text-slate-600">
                        This is a protected placeholder dashboard. Full sidebar and
                        Mock-Test management module will be added in the next steps.
                    </p>
                </section>
            </div>
        </main>
    );
}

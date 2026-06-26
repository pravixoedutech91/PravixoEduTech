"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const ADMIN_TOKEN_STORAGE_KEY = "pravixoAdminToken";
const ADMIN_PROFILE_STORAGE_KEY = "pravixoAdminProfile";

const ALLOWED_ADMIN_ROLES = ["super_admin", "tenant_admin", "content_admin"];

type LoginResponse = {
    success: boolean;
    message?: string;
    token?: string;
    data?: {
        id?: string;
        name?: string;
        mobile?: string;
        email?: string;
        tenantId?: string;
        role?: string;
    };
};

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role));
};

export default function AdminLoginPage() {
    const router = useRouter();

    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const cleanLogin = login.trim();

        setErrorMessage("");
        setSuccessMessage("");

        if (!cleanLogin || !password) {
            setErrorMessage("Please enter admin mobile/email and password.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    login: cleanLogin,
                    password,
                    deviceInfo: "PravixoEduTech Admin Web",
                }),
            });

            const result = (await response.json()) as LoginResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Admin login failed.");
            }

            if (!result.token) {
                throw new Error("Login succeeded but token was not received.");
            }

            if (!isAllowedAdminRole(result.data?.role)) {
                throw new Error("Please login with an admin account.");
            }

            window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, result.token);
            window.localStorage.setItem(
                ADMIN_PROFILE_STORAGE_KEY,
                JSON.stringify(result.data || {})
            );

            setSuccessMessage("Admin login successful. Redirecting to dashboard...");

            router.push("/admin/dashboard");
        } catch (error) {
            window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
            window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);

            setErrorMessage(
                error instanceof Error ? error.message : "Unable to login as admin."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
                <section className="overflow-hidden rounded-3xl bg-white text-slate-950 shadow-xl ring-1 ring-white/10">
                    <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
                        <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-8 text-white md:p-10">
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-100">
                                PravixoEduTech Admin
                            </p>

                            <h1 className="mt-4 text-3xl font-bold md:text-4xl">
                                Admin Login
                            </h1>

                            <p className="mt-4 max-w-xl text-sm leading-6 text-blue-50">
                                Secure access for Super Admin, Tenant Admin, and
                                Content Admin users to manage platform operations.
                            </p>

                            <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-5 text-sm text-blue-50">
                                <p className="font-semibold text-white">
                                    Security note
                                </p>
                                <p className="mt-2">
                                    Student accounts are blocked from this admin
                                    panel. Admin sessions are stored separately from
                                    student sessions.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 md:p-10">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label
                                        htmlFor="admin-login"
                                        className="text-sm font-semibold text-slate-800"
                                    >
                                        Admin mobile number or email
                                    </label>
                                    <input
                                        id="admin-login"
                                        type="text"
                                        value={login}
                                        onChange={(event) =>
                                            setLogin(event.target.value)
                                        }
                                        placeholder="Enter admin mobile or email"
                                        autoComplete="username"
                                        className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="admin-password"
                                        className="text-sm font-semibold text-slate-800"
                                    >
                                        Password
                                    </label>
                                    <input
                                        id="admin-password"
                                        type="password"
                                        value={password}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                        placeholder="Enter password"
                                        autoComplete="current-password"
                                        className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500"
                                    />
                                </div>

                                {errorMessage ? (
                                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                                        {errorMessage}
                                    </div>
                                ) : null}

                                {successMessage ? (
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                                        {successMessage}
                                    </div>
                                ) : null}

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="min-h-12 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    {isSubmitting ? "Logging in..." : "Login as Admin"}
                                </button>
                            </form>

                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                                <Link
                                    href="/"
                                    className="font-semibold text-slate-600 hover:text-blue-700"
                                >
                                    Back to Home
                                </Link>

                                <span className="text-slate-500">
                                    Admin accounts are created by authorized admins.
                                </span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

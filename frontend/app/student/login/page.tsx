"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const STUDENT_TOKEN_STORAGE_KEY = "pravixoStudentToken";
const STUDENT_PROFILE_STORAGE_KEY = "pravixoStudentProfile";

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

export default function StudentLoginPage() {
    const router = useRouter();

    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const cleanLogin = login.trim();

        setErrorMessage("");
        setSuccessMessage("");

        if (!cleanLogin || !password) {
            setErrorMessage("Please enter mobile/email and password.");
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
                    deviceInfo: "PravixoEduTech Student Web",
                }),
            });

            const result = (await response.json()) as LoginResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Login failed.");
            }

            if (!result.token) {
                throw new Error("Login succeeded but token was not received.");
            }

            if (result.data?.role !== "student") {
                throw new Error("Please login with a student account.");
            }

            window.localStorage.setItem(STUDENT_TOKEN_STORAGE_KEY, result.token);
            window.localStorage.setItem(
                STUDENT_PROFILE_STORAGE_KEY,
                JSON.stringify(result.data || {})
            );

            setSuccessMessage("Login successful. Redirecting to your dashboard...");

            router.push("/student");
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Unable to login."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
                <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                    <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
                        <div className="bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-950 p-8 text-white md:p-10">
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-100">
                                PravixoEduTech
                            </p>

                            <h1 className="mt-4 text-3xl font-bold md:text-4xl">
                                Student Login
                            </h1>

                            <p className="mt-4 max-w-xl text-sm leading-6 text-blue-50">
                                Login securely to access your mock tests, resume
                                active attempts, view results, and review your
                                submitted papers.
                            </p>

                            <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-5 text-sm text-blue-50">
                                <p className="font-semibold text-white">
                                    Security note
                                </p>
                                <p className="mt-2">
                                    Your session token is stored only in this
                                    browser for student test access. Logging in
                                    again from another device may replace your
                                    active session.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 md:p-10">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label
                                        htmlFor="student-login"
                                        className="text-sm font-semibold text-slate-800"
                                    >
                                        Mobile number or email
                                    </label>
                                    <input
                                        id="student-login"
                                        type="text"
                                        value={login}
                                        onChange={(event) =>
                                            setLogin(event.target.value)
                                        }
                                        placeholder="Enter mobile or email"
                                        autoComplete="username"
                                        className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="student-password"
                                        className="text-sm font-semibold text-slate-800"
                                    >
                                        Password
                                    </label>
                                    <div className="relative mt-2">
                                        <input
                                            id="student-password"
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(event) =>
                                                setPassword(event.target.value)
                                            }
                                            placeholder="Enter password"
                                            autoComplete="current-password"
                                            className="min-h-12 w-full rounded-2xl border border-slate-300 px-4 pr-16 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowPassword(
                                                    (current) => !current
                                                )
                                            }
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                            className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-semibold text-blue-700 hover:text-blue-900 focus:outline-none"
                                        >
                                            {showPassword ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </div>
                                <div className="-mt-2 text-right">
                                    <Link
                                        href="/student/forgot-password"
                                        className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                                    >
                                        Forgot password?
                                    </Link>
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
                                    className="min-h-12 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    {isSubmitting ? "Logging in..." : "Login"}
                                </button>
                            </form>

                            <div className="mt-6 border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
                                New to Pravixo?{" "}
                                <Link
                                    href="/student/register"
                                    className="font-semibold text-blue-700 hover:text-blue-800"
                                >
                                    Create Account
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

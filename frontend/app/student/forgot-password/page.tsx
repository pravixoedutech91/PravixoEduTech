"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const GENERIC_SUCCESS_MESSAGE =
    "If an eligible account exists, password reset instructions have been sent.";

type ForgotPasswordResponse = {
    success?: boolean;
    message?: string;
};

export default function StudentForgotPasswordPage() {
    const [login, setLogin] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [requestCompleted, setRequestCompleted] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const cleanLogin = login.trim();

        setErrorMessage("");

        if (!cleanLogin) {
            setErrorMessage("Please enter your mobile number or email.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/auth/forgot-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        login: cleanLogin,
                    }),
                }
            );

            let result: ForgotPasswordResponse = {};

            try {
                result = (await response.json()) as ForgotPasswordResponse;
            } catch {
                result = {};
            }

            if (!response.ok) {
                throw new Error(
                    response.status === 429
                        ? "Too many requests. Please wait a few minutes and try again."
                        : "Unable to submit your request right now. Please try again."
                );
            }

            /*
             * Do not expose account eligibility through frontend messaging.
             * The backend intentionally returns one generic response.
             */
            setRequestCompleted(true);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Unable to submit your request right now. Please try again."
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
                                Forgot Password
                            </h1>

                            <p className="mt-4 max-w-xl text-sm leading-6 text-blue-50">
                                Enter the mobile number or email linked to your
                                student account. If the account is eligible, we
                                will send secure password reset instructions to
                                its registered email address.
                            </p>

                            <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-5 text-sm text-blue-50">
                                <p className="font-semibold text-white">
                                    Security note
                                </p>

                                <p className="mt-2">
                                    For privacy, PravixoEduTech does not confirm
                                    whether a particular mobile number or email
                                    is registered. Reset links are short-lived
                                    and can be used only once.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 md:p-10">
                            {requestCompleted ? (
                                <div>
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                                        <p className="font-semibold">
                                            Request received
                                        </p>

                                        <p className="mt-2 leading-6">
                                            {GENERIC_SUCCESS_MESSAGE}
                                        </p>
                                    </div>

                                    <p className="mt-5 text-sm leading-6 text-slate-600">
                                        Check the registered email inbox and
                                        spam folder. The reset link expires
                                        shortly for your security.
                                    </p>

                                    <div className="mt-6 space-y-3">
                                        <Link
                                            href="/student/login"
                                            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                                        >
                                            Back to Login
                                        </Link>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRequestCompleted(false);
                                                setErrorMessage("");
                                            }}
                                            className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                        >
                                            Try another mobile or email
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <form
                                        onSubmit={handleSubmit}
                                        className="space-y-5"
                                    >
                                        <div>
                                            <label
                                                htmlFor="student-recovery-login"
                                                className="text-sm font-semibold text-slate-800"
                                            >
                                                Mobile number or email
                                            </label>

                                            <input
                                                id="student-recovery-login"
                                                type="text"
                                                value={login}
                                                onChange={(event) =>
                                                    setLogin(event.target.value)
                                                }
                                                placeholder="Enter mobile or email"
                                                autoComplete="username"
                                                disabled={isSubmitting}
                                                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                            />
                                        </div>

                                        {errorMessage ? (
                                            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                                                {errorMessage}
                                            </div>
                                        ) : null}

                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="min-h-12 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                        >
                                            {isSubmitting
                                                ? "Sending instructions..."
                                                : "Send Reset Instructions"}
                                        </button>
                                    </form>

                                    <div className="mt-6 border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
                                        Remember your password?{" "}
                                        <Link
                                            href="/student/login"
                                            className="font-semibold text-blue-700 hover:text-blue-800"
                                        >
                                            Back to Login
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

"use client";

import Link from "next/link";
import {
    FormEvent,
    useEffect,
    useRef,
    useState,
} from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const RESET_TOKEN_PATTERN =
    /^[A-Za-z0-9_-]{43}$/;

const PASSWORD_MIN_CHARACTERS = 8;
const PASSWORD_MAX_UTF8_BYTES = 72;

const INVALID_RESET_MESSAGE =
    "This password reset link is invalid or has expired. Please request a new one.";

const SUCCESS_RESET_MESSAGE =
    "Password reset successfully. Please sign in again.";

type ResetLinkState =
    | "initializing"
    | "ready"
    | "invalid"
    | "completed";

type ResetPasswordResponse = {
    success?: boolean;
    message?: string;
};

const getUtf8ByteLength = (
    value: string
) => {
    return new TextEncoder().encode(value).length;
};

const extractResetTokenFromHash = (
    hash: string
) => {
    if (
        typeof hash !== "string" ||
        hash.length < 2 ||
        hash.length > 128
    ) {
        return "";
    }

    const fragment =
        hash.startsWith("#")
            ? hash.slice(1)
            : hash;

    let params: URLSearchParams;

    try {
        params =
            new URLSearchParams(fragment);
    } catch {
        return "";
    }

    const entries =
        Array.from(params.entries());

    if (
        entries.length !== 1 ||
        entries[0][0] !== "token"
    ) {
        return "";
    }

    const token =
        entries[0][1];

    return RESET_TOKEN_PATTERN.test(token)
        ? token
        : "";
};

export default function StudentResetPasswordPage() {
    /*
     * Recovery credential intentionally lives only
     * in component memory and never in React state,
     * browser storage, cookies or navigation state.
     */
    const resetTokenRef =
        useRef("");

    /*
     * React development Strict Mode may execute the
     * effect setup more than once. Prevent a second
     * pass from treating the already-scrubbed URL as
     * an invalid reset link.
     */
    const fragmentCapturedRef =
        useRef(false);

    const [linkState, setLinkState] =
        useState<ResetLinkState>("initializing");

    const [password, setPassword] =
        useState("");

    const [confirmPassword, setConfirmPassword] =
        useState("");

    const [showPassword, setShowPassword] =
        useState(false);

    const [
        showConfirmPassword,
        setShowConfirmPassword,
    ] = useState(false);

    const [isSubmitting, setIsSubmitting] =
        useState(false);

    const [errorMessage, setErrorMessage] =
        useState("");

    const [successMessage, setSuccessMessage] =
        useState("");

    useEffect(() => {
        if (fragmentCapturedRef.current) {
            return;
        }

        fragmentCapturedRef.current = true;

        let capturedToken = "";

        try {
            capturedToken =
                extractResetTokenFromHash(
                    window.location.hash
                );
        } finally {
            /*
             * Scrub both fragment and any unexpected
             * query string immediately after capture.
             *
             * The canonical recovery page requires
             * neither query parameters nor redirects.
             */
            window.history.replaceState(
                null,
                "",
                window.location.pathname
            );
        }

        if (!capturedToken) {
            resetTokenRef.current = "";
            setLinkState("invalid");
            return;
        }

        resetTokenRef.current =
            capturedToken;

        setLinkState("ready");
    }, []);

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        setErrorMessage("");
        setSuccessMessage("");

        if (
            linkState !== "ready" ||
            !resetTokenRef.current
        ) {
            setLinkState("invalid");
            setErrorMessage(
                INVALID_RESET_MESSAGE
            );
            return;
        }

        if (
            password.length <
            PASSWORD_MIN_CHARACTERS
        ) {
            setErrorMessage(
                "Password must be at least 8 characters."
            );
            return;
        }

        if (
            getUtf8ByteLength(password) >
            PASSWORD_MAX_UTF8_BYTES
        ) {
            setErrorMessage(
                "Password must not exceed 72 UTF-8 bytes."
            );
            return;
        }

        if (password !== confirmPassword) {
            setErrorMessage(
                "Password and confirm password do not match."
            );
            return;
        }

        const token =
            resetTokenRef.current;

        setIsSubmitting(true);

        try {
            const response =
                await fetch(
                    API_BASE_URL +
                        "/api/auth/reset-password",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            token,
                            password,
                        }),
                    }
                );

            let result:
                ResetPasswordResponse = {};

            try {
                result =
                    (await response.json()) as
                        ResetPasswordResponse;
            } catch {
                result = {};
            }

            if (
                !response.ok ||
                result.success !== true
            ) {
                if (response.status === 429) {
                    throw new Error(
                        "Too many reset attempts. Please wait a few minutes and try again."
                    );
                }

                throw new Error(
                    result.message ||
                        "Unable to reset your password. Please request a new reset link."
                );
            }

            /*
             * Destroy the in-memory recovery
             * credential immediately after success.
             */
            resetTokenRef.current = "";

            setPassword("");
            setConfirmPassword("");

            setSuccessMessage(
                result.message ||
                    SUCCESS_RESET_MESSAGE
            );

            setLinkState("completed");
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Unable to reset your password. Please try again."
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
                                Reset Password
                            </h1>

                            <p className="mt-4 max-w-xl text-sm leading-6 text-blue-50">
                                Create a new password for your
                                student account using the secure,
                                short-lived recovery link sent to
                                your registered email.
                            </p>

                            <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-5 text-sm text-blue-50">
                                <p className="font-semibold text-white">
                                    Secure recovery
                                </p>

                                <p className="mt-2 leading-6">
                                    The reset credential is removed
                                    from the browser address bar
                                    after this page opens and is not
                                    stored in browser storage. After
                                    resetting your password, you must
                                    sign in again.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 md:p-10">
                            {linkState ===
                            "initializing" ? (
                                <div
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600"
                                    role="status"
                                >
                                    Verifying your secure reset
                                    link...
                                </div>
                            ) : null}

                            {linkState === "invalid" ? (
                                <div>
                                    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                                        <p className="font-semibold">
                                            Reset link unavailable
                                        </p>

                                        <p className="mt-2 leading-6">
                                            {errorMessage ||
                                                INVALID_RESET_MESSAGE}
                                        </p>
                                    </div>

                                    <div className="mt-6 space-y-3">
                                        <Link
                                            href="/student/forgot-password"
                                            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                                        >
                                            Request New Reset Link
                                        </Link>

                                        <Link
                                            href="/student/login"
                                            className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                        >
                                            Back to Login
                                        </Link>
                                    </div>
                                </div>
                            ) : null}

                            {linkState === "completed" ? (
                                <div>
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                                        <p className="font-semibold">
                                            Password updated
                                        </p>

                                        <p className="mt-2 leading-6">
                                            {successMessage ||
                                                SUCCESS_RESET_MESSAGE}
                                        </p>
                                    </div>

                                    <p className="mt-5 text-sm leading-6 text-slate-600">
                                        Existing student sessions
                                        have been invalidated. Sign in
                                        again using your new password.
                                    </p>

                                    <Link
                                        href="/student/login"
                                        className="mt-6 flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                                    >
                                        Sign In
                                    </Link>
                                </div>
                            ) : null}

                            {linkState === "ready" ? (
                                <form
                                    onSubmit={handleSubmit}
                                    className="space-y-5"
                                >
                                    <div>
                                        <label
                                            htmlFor="student-new-password"
                                            className="text-sm font-semibold text-slate-800"
                                        >
                                            New password
                                        </label>

                                        <div className="relative mt-2">
                                            <input
                                                id="student-new-password"
                                                type={
                                                    showPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                value={password}
                                                onChange={(event) =>
                                                    setPassword(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Enter new password"
                                                autoComplete="new-password"
                                                disabled={isSubmitting}
                                                className="min-h-12 w-full rounded-2xl border border-slate-300 px-4 pr-16 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                            />

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowPassword(
                                                        (current) =>
                                                            !current
                                                    )
                                                }
                                                aria-label={
                                                    showPassword
                                                        ? "Hide new password"
                                                        : "Show new password"
                                                }
                                                className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-semibold text-blue-700 hover:text-blue-900 focus:outline-none"
                                            >
                                                {showPassword
                                                    ? "Hide"
                                                    : "Show"}
                                            </button>
                                        </div>

                                        <p className="mt-2 text-xs leading-5 text-slate-500">
                                            Use at least 8 characters.
                                            Passwords are limited to 72
                                            UTF-8 bytes.
                                        </p>
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="student-confirm-password"
                                            className="text-sm font-semibold text-slate-800"
                                        >
                                            Confirm new password
                                        </label>

                                        <div className="relative mt-2">
                                            <input
                                                id="student-confirm-password"
                                                type={
                                                    showConfirmPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                value={
                                                    confirmPassword
                                                }
                                                onChange={(event) =>
                                                    setConfirmPassword(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Re-enter new password"
                                                autoComplete="new-password"
                                                disabled={isSubmitting}
                                                className="min-h-12 w-full rounded-2xl border border-slate-300 px-4 pr-16 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                            />

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowConfirmPassword(
                                                        (current) =>
                                                            !current
                                                    )
                                                }
                                                aria-label={
                                                    showConfirmPassword
                                                        ? "Hide confirm password"
                                                        : "Show confirm password"
                                                }
                                                className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-semibold text-blue-700 hover:text-blue-900 focus:outline-none"
                                            >
                                                {showConfirmPassword
                                                    ? "Hide"
                                                    : "Show"}
                                            </button>
                                        </div>
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
                                            ? "Updating password..."
                                            : "Reset Password"}
                                    </button>

                                    <div className="border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
                                        Need a different link?{" "}
                                        <Link
                                            href="/student/forgot-password"
                                            className="font-semibold text-blue-700 hover:text-blue-800"
                                        >
                                            Request another
                                        </Link>
                                    </div>
                                </form>
                            ) : null}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

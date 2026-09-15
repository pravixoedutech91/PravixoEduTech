"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const REGISTRATION_DEVICE_INFO = "PravixoEduTech Student Web";

type RegisterResponse = {
    success?: boolean;
    code?: string;
    message?: string;
    data?: {
        emailVerificationRequired?: boolean;
        verificationEmailSent?: boolean;
    };
};

type ResendVerificationResponse = {
    success?: boolean;
    message?: string;
};

const EMAIL_VERIFICATION_REQUIRED_CODE =
    "EMAIL_VERIFICATION_REQUIRED";

const GENERIC_RESEND_MESSAGE =
    "If an eligible account exists, email verification instructions have been sent.";

const RESEND_VERIFICATION_COOLDOWN_SECONDS = 120;

const formatResendCooldown = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
        remainingSeconds
    ).padStart(2, "0")}`;
};

const normalizeName = (value: string) =>
    value.trim().replace(/\s+/g, " ");

const normalizeMobile = (value: string) =>
    value.replace(/\D/g, "");

const normalizeEmail = (value: string) =>
    value.trim().toLowerCase();

const isValidEmail = (value: string) => {
    if (!value || value.length > 254 || value.includes(" ")) {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const getUtf8ByteLength = (value: string) =>
    new TextEncoder().encode(value).length;

export default function StudentRegisterPage() {

    const [name, setName] = useState("");
    const [mobile, setMobile] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [referralCode, setReferralCode] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] =
        useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const [registrationComplete, setRegistrationComplete] =
        useState(false);

    const [registrationEmail, setRegistrationEmail] = useState("");

    const [verificationEmailSent, setVerificationEmailSent] =
        useState(false);

    const [isResendingVerification, setIsResendingVerification] =
        useState(false);

    const [resendCooldownSeconds, setResendCooldownSeconds] =
        useState(0);

    const [resendMessage, setResendMessage] = useState("");
    const [resendError, setResendError] = useState("");

    useEffect(() => {
        if (resendCooldownSeconds <= 0) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setResendCooldownSeconds((current) =>
                Math.max(0, current - 1)
            );
        }, 1000);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [resendCooldownSeconds]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        setErrorMessage("");
        setSuccessMessage("");

        const cleanName = normalizeName(name);
        const cleanMobile = normalizeMobile(mobile);
        const cleanEmail = normalizeEmail(email);
        const cleanReferralCode = referralCode.trim();

        if (cleanName.length < 2 || cleanName.length > 100) {
            setErrorMessage("Please enter your full name.");
            return;
        }

        if (!/^[0-9]{10}$/.test(cleanMobile)) {
            setErrorMessage("Please enter a valid 10-digit mobile number.");
            return;
        }

        if (!isValidEmail(cleanEmail)) {
            setErrorMessage("Please enter a valid email address.");
            return;
        }

        if (password.length < 8) {
            setErrorMessage("Password must be at least 8 characters.");
            return;
        }

        if (getUtf8ByteLength(password) > 72) {
            setErrorMessage("Password is too long.");
            return;
        }

        if (password !== confirmPassword) {
            setErrorMessage("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: cleanName,
                    mobile: cleanMobile,
                    email: cleanEmail,
                    password,
                    referralCode: cleanReferralCode,
                    deviceInfo: REGISTRATION_DEVICE_INFO,
                }),
            });

            const result = (await response.json()) as RegisterResponse;

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to create your account."
                );
            }

            if (
                result.code !==
                    EMAIL_VERIFICATION_REQUIRED_CODE ||
                result.data?.emailVerificationRequired !== true
            ) {
                throw new Error(
                    "Account was created, but the email verification state was not confirmed. Please use Student Login or contact support."
                );
            }

            const wasVerificationEmailSent =
                result.data.verificationEmailSent === true;

            setRegistrationEmail(cleanEmail);
            setVerificationEmailSent(
                wasVerificationEmailSent
            );
            setResendCooldownSeconds(
                wasVerificationEmailSent
                    ? RESEND_VERIFICATION_COOLDOWN_SECONDS
                    : 0
            );

            setPassword("");
            setConfirmPassword("");

            setSuccessMessage(
                result.message ||
                    "Account created successfully. Please verify your email before signing in."
            );

            setRegistrationComplete(true);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Unable to create your account."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendVerification = async () => {
        if (
            !registrationComplete ||
            !registrationEmail ||
            isResendingVerification ||
            resendCooldownSeconds > 0
        ) {
            return;
        }

        setResendMessage("");
        setResendError("");
        setIsResendingVerification(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/auth/resend-email-verification`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        login: registrationEmail,
                    }),
                }
            );

            let result: ResendVerificationResponse = {};

            try {
                result =
                    (await response.json()) as
                        ResendVerificationResponse;
            } catch {
                result = {};
            }

            if (
                !response.ok ||
                result.success !== true
            ) {
                if (response.status === 429) {
                    throw new Error(
                        "Too many verification requests. Please wait a few minutes and try again."
                    );
                }

                throw new Error(
                    "Unable to request another verification email right now. Please try again later."
                );
            }

            setResendMessage(
                result.message ||
                    GENERIC_RESEND_MESSAGE
            );
            setResendCooldownSeconds(
                RESEND_VERIFICATION_COOLDOWN_SECONDS
            );
        } catch (error) {
            setResendError(
                error instanceof Error
                    ? error.message
                    : "Unable to request another verification email right now."
            );
        } finally {
            setIsResendingVerification(false);
        }
    };

    if (registrationComplete) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-3xl flex-col gap-6">
                    <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                        <div className="bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-950 p-8 text-white sm:p-10">
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-100">
                                PravixoEduTech
                            </p>

                            <h1 className="mt-4 text-3xl font-bold md:text-4xl">
                                Check your email
                            </h1>

                            <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                                Your student account has been created, but
                                you must verify your email before signing in.
                            </p>
                        </div>

                        <div className="p-6 sm:p-8">
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                                <p className="font-semibold">
                                    Account created successfully
                                </p>

                                <p className="mt-2 leading-6">
                                    {successMessage}
                                </p>
                            </div>

                            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Verification email
                                </p>

                                <p className="mt-2 break-all font-semibold text-slate-900">
                                    {registrationEmail}
                                </p>

                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                    {verificationEmailSent
                                        ? "A verification link was sent to this email address. Open that link to activate sign-in access."
                                        : "Your account was created, but the first verification email could not be sent. You can request another verification email below."}
                                </p>
                            </div>

                            <div className="mt-6 space-y-3">
                                <button
                                    type="button"
                                    onClick={() =>
                                        void handleResendVerification()
                                    }
                                    disabled={
                                        isResendingVerification ||
                                        resendCooldownSeconds > 0
                                    }
                                    className="min-h-12 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    {isResendingVerification
                                        ? "Requesting verification email..."
                                        : resendCooldownSeconds > 0
                                          ? `Resend available in ${formatResendCooldown(
                                                resendCooldownSeconds
                                            )}`
                                          : "Resend Verification Email"}
                                </button>

                                {resendMessage ? (
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium leading-6 text-emerald-800">
                                        {resendMessage}
                                    </div>
                                ) : null}

                                {resendError ? (
                                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-700">
                                        {resendError}
                                    </div>
                                ) : null}
                            </div>

                            <p className="mt-6 text-sm leading-6 text-slate-600">
                                After verifying your email, return to Student
                                Login. Verification itself will not sign you
                                in automatically.
                            </p>

                            <Link
                                href="/student/login"
                                className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Go to Student Login
                            </Link>
                        </div>
                    </section>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-8 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                    <div className="grid md:grid-cols-[0.92fr_1.08fr]">
                        <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-950 p-7 text-white sm:p-9 md:p-10">
                            <div className="relative z-10">
                                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-100">
                                    PravixoEduTech
                                </p>

                                <h1 className="mt-4 max-w-lg text-3xl font-bold tracking-tight md:text-4xl">
                                    Create your learning account
                                </h1>

                                <p className="mt-4 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
                                    Build your exam preparation workspace with
                                    mock tests, PYQs, performance insights and
                                    learning resources in one place.
                                </p>

                                <div className="mt-8 grid gap-3">
                                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                        <p className="font-semibold text-white">
                                            Practice with purpose
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-blue-100">
                                            Attempt tests, resume your progress
                                            and review every submitted paper.
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                        <p className="font-semibold text-white">
                                            Track your improvement
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-blue-100">
                                            See results, accuracy and detailed
                                            question-level review as you learn.
                                        </p>
                                    </div>
                                </div>

                                <p className="mt-8 text-sm text-blue-100">
                                    Already registered?{" "}
                                    <Link
                                        href="/student/login"
                                        className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
                                    >
                                        Sign in to your account
                                    </Link>
                                </p>
                            </div>

                            <div
                                aria-hidden="true"
                                className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl"
                            />
                            <div
                                aria-hidden="true"
                                className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl"
                            />
                        </div>

                        <div className="p-6 sm:p-8 md:p-10">
                            <div className="mx-auto max-w-xl">
                                <div>
                                    <p className="text-sm font-semibold text-blue-700">
                                        Student registration
                                    </p>

                                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                                        Create Account
                                    </h2>

                                    <p className="mt-2 text-sm leading-6 text-slate-500">
                                        Enter your details to start your Pravixo
                                        learning journey.
                                    </p>
                                </div>

                                <form
                                    onSubmit={handleSubmit}
                                    className="mt-7 space-y-5"
                                >
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
                                        Use your own active email address and a valid
                                        10-digit mobile number. We will send your
                                        account verification link to the email
                                        address you provide.
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="student-name"
                                            className="text-sm font-semibold text-slate-800"
                                        >
                                            Full name
                                        </label>

                                        <input
                                            id="student-name"
                                            type="text"
                                            value={name}
                                            onChange={(event) =>
                                                setName(event.target.value)
                                            }
                                            placeholder="Enter your full name"
                                            autoComplete="name"
                                            maxLength={100}
                                            className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        />
                                    </div>

                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <div>
                                            <label
                                                htmlFor="student-mobile"
                                                className="text-sm font-semibold text-slate-800"
                                            >
                                                Mobile number
                                            </label>

                                            <input
                                                id="student-mobile"
                                                type="tel"
                                                inputMode="numeric"
                                                value={mobile}
                                                onChange={(event) =>
                                                    setMobile(event.target.value)
                                                }
                                                placeholder="10-digit mobile"
                                                autoComplete="tel"
                                                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </div>

                                        <div>
                                            <label
                                                htmlFor="student-email"
                                                className="text-sm font-semibold text-slate-800"
                                            >
                                                Email address
                                            </label>

                                            <input
                                                id="student-email"
                                                type="email"
                                                value={email}
                                                onChange={(event) =>
                                                    setEmail(event.target.value)
                                                }
                                                placeholder="you@example.com"
                                                autoComplete="email"
                                                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-5 sm:grid-cols-2">
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
                                                        setPassword(
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="Minimum 8 characters"
                                                    autoComplete="new-password"
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

                                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                                Use at least 8 characters. Choose a password you can
                                                remember because you will need it to sign in after
                                                email verification. If you forget it, use Forgot
                                                Password.
                                            </p>
                                        </div>

                                        <div>
                                            <label
                                                htmlFor="student-confirm-password"
                                                className="text-sm font-semibold text-slate-800"
                                            >
                                                Confirm password
                                            </label>

                                            <div className="relative mt-2">
                                                <input
                                                    id="student-confirm-password"
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    value={confirmPassword}
                                                    onChange={(event) =>
                                                        setConfirmPassword(
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="Re-enter password"
                                                    autoComplete="new-password"
                                                    className="min-h-12 w-full rounded-2xl border border-slate-300 px-4 pr-16 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                />

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setShowConfirmPassword(
                                                            (current) => !current
                                                        )
                                                    }
                                                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                                                    className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-semibold text-blue-700 hover:text-blue-900 focus:outline-none"
                                                >
                                                    {showConfirmPassword ? "Hide" : "Show"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between gap-3">
                                            <label
                                                htmlFor="student-referral-code"
                                                className="text-sm font-semibold text-slate-800"
                                            >
                                                Referral code
                                            </label>

                                            <span className="text-xs font-medium text-slate-400">
                                                Optional
                                            </span>
                                        </div>

                                        <input
                                            id="student-referral-code"
                                            type="text"
                                            value={referralCode}
                                            onChange={(event) =>
                                                setReferralCode(
                                                    event.target.value
                                                )
                                            }
                                            placeholder="Enter referral code, if any"
                                            autoComplete="off"
                                            className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        />
                                    </div>

                                    {errorMessage ? (
                                        <div
                                            role="alert"
                                            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
                                        >
                                            {errorMessage}
                                        </div>
                                    ) : null}

                                    {successMessage ? (
                                        <div
                                            role="status"
                                            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700"
                                        >
                                            {successMessage}
                                        </div>
                                    ) : null}

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="min-h-12 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                        {isSubmitting
                                            ? "Creating account..."
                                            : "Create Account"}
                                    </button>
                                </form>

                                <div className="mt-6 border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
                                    Already have an account?{" "}
                                    <Link
                                        href="/student/login"
                                        className="font-semibold text-blue-700 hover:text-blue-800"
                                    >
                                        Sign in
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <p className="text-center text-xs leading-5 text-slate-500">
                    By creating an account, you agree to use PravixoEduTech
                    responsibly and keep your login credentials secure.
                </p>
            </div>
        </main>
    );
}
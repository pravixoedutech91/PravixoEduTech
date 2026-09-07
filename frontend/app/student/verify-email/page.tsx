"use client";

import Link from "next/link";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const EMAIL_VERIFICATION_TOKEN_PATTERN =
    /^[A-Za-z0-9_-]{43}$/;

const INVALID_VERIFICATION_MESSAGE =
    "This email verification link is invalid or has expired. Please request a new one.";

const SUCCESS_VERIFICATION_MESSAGE =
    "Email verified successfully. Please sign in.";

type VerificationState =
    | "initializing"
    | "verifying"
    | "verified"
    | "invalid"
    | "error";

type VerifyEmailResponse = {
    success?: boolean;
    message?: string;
};

const extractVerificationTokenFromHash = (
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

    return EMAIL_VERIFICATION_TOKEN_PATTERN.test(
        token
    )
        ? token
        : "";
};

export default function StudentVerifyEmailPage() {
    /*
     * The verification credential intentionally lives
     * only in component memory. It is never placed in
     * React state, browser storage, cookies or navigation
     * state.
     */
    const verificationTokenRef =
        useRef("");

    /*
     * React development Strict Mode can execute effect
     * setup more than once. Once the fragment has been
     * captured and scrubbed, do not parse the URL again.
     */
    const fragmentCapturedRef =
        useRef(false);

    const verificationRequestActiveRef =
        useRef(false);

    const [verificationState, setVerificationState] =
        useState<VerificationState>("initializing");

    const [message, setMessage] =
        useState("");

    const verifyCapturedToken =
        useCallback(async () => {
            if (
                verificationRequestActiveRef.current
            ) {
                return;
            }

            const token =
                verificationTokenRef.current;

            if (!token) {
                verificationTokenRef.current = "";
                setVerificationState("invalid");
                setMessage(
                    INVALID_VERIFICATION_MESSAGE
                );
                return;
            }

            verificationRequestActiveRef.current =
                true;

            setVerificationState("verifying");
            setMessage("");

            try {
                const response =
                    await fetch(
                        API_BASE_URL +
                            "/api/auth/verify-email",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                            },
                            body: JSON.stringify({
                                token,
                            }),
                        }
                    );

                let result:
                    VerifyEmailResponse = {};

                try {
                    result =
                        (await response.json()) as
                            VerifyEmailResponse;
                } catch {
                    result = {};
                }

                if (
                    response.ok &&
                    result.success === true
                ) {
                    /*
                     * Credential is single-purpose and is
                     * destroyed immediately after success.
                     */
                    verificationTokenRef.current = "";

                    setVerificationState("verified");
                    setMessage(
                        result.message ||
                            SUCCESS_VERIFICATION_MESSAGE
                    );
                    return;
                }

                if (response.status === 400) {
                    /*
                     * Invalid/expired credentials are no
                     * longer useful and must not remain
                     * resident in component memory.
                     */
                    verificationTokenRef.current = "";

                    setVerificationState("invalid");
                    setMessage(
                        result.message ||
                            INVALID_VERIFICATION_MESSAGE
                    );
                    return;
                }

                if (response.status === 429) {
                    throw new Error(
                        "Too many verification attempts. Please wait a few minutes and try again."
                    );
                }

                throw new Error(
                    result.message ||
                        "Unable to verify your email right now. Please try again."
                );
            } catch (error) {
                /*
                 * For transient network/server/rate-limit
                 * failures the already-scrubbed credential
                 * remains only in this component instance
                 * so the student may retry without exposing
                 * it back into the URL.
                 */
                setVerificationState("error");

                setMessage(
                    error instanceof Error
                        ? error.message
                        : "Unable to verify your email right now. Please try again."
                );
            } finally {
                verificationRequestActiveRef.current =
                    false;
            }
        }, []);

    useEffect(() => {
        if (fragmentCapturedRef.current) {
            return;
        }

        fragmentCapturedRef.current =
            true;

        let capturedToken = "";

        try {
            capturedToken =
                extractVerificationTokenFromHash(
                    window.location.hash
                );
        } finally {
            /*
             * Scrub the fragment and any unexpected query
             * string immediately after capture.
             */
            window.history.replaceState(
                null,
                "",
                window.location.pathname
            );
        }

        if (!capturedToken) {
            verificationTokenRef.current = "";
            setVerificationState("invalid");
            setMessage(
                INVALID_VERIFICATION_MESSAGE
            );
            return;
        }

        verificationTokenRef.current =
            capturedToken;

        void verifyCapturedToken();
    }, [verifyCapturedToken]);

    const isBusy =
        verificationState === "initializing" ||
        verificationState === "verifying";

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                    <div className="bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-950 p-8 text-white sm:p-10">
                        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-100">
                            PravixoEduTech
                        </p>

                        <h1 className="mt-4 text-3xl font-bold md:text-4xl">
                            Verify your email
                        </h1>

                        <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                            Email verification protects your
                            student account before sign-in access
                            is enabled.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        {isBusy ? (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
                                <p className="font-semibold">
                                    Verifying your email...
                                </p>

                                <p className="mt-2 text-sm leading-6 text-blue-800">
                                    Please keep this page open while
                                    the secure verification link is
                                    being checked.
                                </p>
                            </div>
                        ) : null}

                        {verificationState ===
                        "verified" ? (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                                <p className="font-semibold">
                                    Email verified
                                </p>

                                <p className="mt-2 text-sm leading-6">
                                    {message}
                                </p>

                                <p className="mt-3 text-sm leading-6 text-emerald-800">
                                    Verification does not sign you in
                                    automatically. Use your student
                                    credentials to sign in.
                                </p>
                            </div>
                        ) : null}

                        {verificationState ===
                        "invalid" ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
                                <p className="font-semibold">
                                    Verification link unavailable
                                </p>

                                <p className="mt-2 text-sm leading-6">
                                    {message ||
                                        INVALID_VERIFICATION_MESSAGE}
                                </p>

                                <p className="mt-3 text-xs leading-5 text-red-700">
                                    If your account is still awaiting
                                    verification, sign in with your
                                    credentials and use the resend
                                    verification option.
                                </p>
                            </div>
                        ) : null}

                        {verificationState ===
                        "error" ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                                <p className="font-semibold">
                                    Verification could not complete
                                </p>

                                <p className="mt-2 text-sm leading-6">
                                    {message}
                                </p>

                                <button
                                    type="button"
                                    onClick={() =>
                                        void verifyCapturedToken()
                                    }
                                    className="mt-4 min-h-11 w-full rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                                >
                                    Retry Verification
                                </button>
                            </div>
                        ) : null}

                        {!isBusy ? (
                            <div className="mt-6 border-t border-slate-200 pt-6">
                                <Link
                                    href="/student/login"
                                    className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                                >
                                    Go to Student Login
                                </Link>
                            </div>
                        ) : null}
                    </div>
                </section>
            </div>
        </main>
    );
}

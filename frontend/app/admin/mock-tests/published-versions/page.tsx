"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ADMIN_TOKEN_STORAGE_KEY = "pravixoAdminToken";
const ADMIN_PROFILE_STORAGE_KEY = "pravixoAdminProfile";

const clearAdminSessionStorage = () => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

export default function AdminPublishedVersionsPage() {
    const [isChecking, setIsChecking] = useState(true);
    const [isAllowed, setIsAllowed] = useState(false);
    const [message, setMessage] = useState("Checking admin session...");

    useEffect(() => {
        const verifyAdminSession = () => {
            const savedToken = window.localStorage.getItem(
                ADMIN_TOKEN_STORAGE_KEY
            );
            const savedProfile = window.localStorage.getItem(
                ADMIN_PROFILE_STORAGE_KEY
            );

            if (!savedToken || !savedProfile) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage("Please login with an admin account.");
                setIsChecking(false);
                return;
            }

            try {
                const adminProfile = JSON.parse(savedProfile) as {
                    role?: string;
                };

                if (
                    adminProfile.role !== "super_admin" &&
                    adminProfile.role !== "tenant_admin" &&
                    adminProfile.role !== "content_admin"
                ) {
                    clearAdminSessionStorage();
                    setIsAllowed(false);
                    setMessage(
                        "Access denied. This page is only for admin users."
                    );
                    setIsChecking(false);
                    return;
                }

                setIsAllowed(true);
                setMessage("Admin session verified.");
            } catch {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage("Invalid admin session. Please login again.");
            } finally {
                setIsChecking(false);
            }
        };

        verifyAdminSession();
    }, []);

    if (isChecking) {
        return (
            <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
                <section className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold text-slate-600">
                        {message}
                    </p>
                </section>
            </main>
        );
    }

    if (!isAllowed) {
        return (
            <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
                <section className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold text-red-600">
                        {message}
                    </p>

                    <Link
                        href="/admin/login"
                        className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                        Go to Admin Login
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
            <div className="mx-auto grid max-w-6xl gap-6">
                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <p className="text-xs font-bold uppercase tracking-[0.35em] text-blue-700">
                        Mock-Test Admin
                    </p>

                    <h1 className="mt-3 text-3xl font-black">
                        Published Versions
                    </h1>

                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                        View frozen published snapshots of mock tests. Each
                        version keeps its own exam pattern snapshot, section
                        snapshot, question snapshot, settings, and published
                        metadata.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            href="/admin/dashboard"
                            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            Dashboard
                        </Link>

                        <Link
                            href="/admin/mock-tests/tests"
                            className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Mock Test Builder
                        </Link>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            API
                        </p>
                        <p className="mt-3 text-sm font-bold">
                            /api/mock-tests/:id/versions
                        </p>
                    </div>

                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Step
                        </p>
                        <p className="mt-3 text-sm font-bold">
                            T-42P Step 2
                        </p>
                    </div>

                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Status
                        </p>
                        <p className="mt-3 text-sm font-bold text-amber-700">
                            Shell ready
                        </p>
                    </div>
                </section>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Coming in Step 3
                    </p>

                    <h2 className="mt-2 text-xl font-bold">
                        Connect Published Versions List
                    </h2>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {[
                            "Load mock tests for selection",
                            "Call GET /api/mock-tests/:id/versions",
                            "Show version count and published date",
                            "Show exam pattern snapshot summary",
                            "Show section and question snapshot counts",
                            "Highlight active/latest version",
                        ].map((item) => (
                            <div
                                key={item}
                                className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}

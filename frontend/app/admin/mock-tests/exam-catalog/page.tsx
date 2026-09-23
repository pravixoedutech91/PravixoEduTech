"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const ADMIN_TOKEN_STORAGE_KEY = "pravixoAdminToken";
const ADMIN_PROFILE_STORAGE_KEY = "pravixoAdminProfile";

const ALLOWED_ADMIN_ROLES = [
    "super_admin",
    "tenant_admin",
    "content_admin",
];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type AdminProfile = {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
    tenantId?: string | null;
};

type AuthMeResponse = {
    success?: boolean;
    message?: string;
    user?: AdminProfile;
    data?:
        | AdminProfile
        | {
              user?: AdminProfile;
          };
};

type ExamCatalogNode = {
    _id: string;
    kind: "exam_family" | "exam";
    parentId?: string | null;
    canonicalKey?: string;
    slug: string;
    nameEn?: string;
    nameHi?: string;
    aliasesEn?: string[];
    aliasesHi?: string[];
    descriptionEn?: string;
    descriptionHi?: string;
    order?: number;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
};

type ExamFamily = ExamCatalogNode & {
    kind: "exam_family";
    exams: ExamCatalogNode[];
};

type ExamCatalogResponse = {
    success?: boolean;
    count?: number;
    examCount?: number;
    message?: string;
    data?: ExamFamily[];
};

type MutationResponse = {
    success?: boolean;
    message?: string;
    data?: ExamCatalogNode;
};

type CatalogForm = {
    slug: string;
    nameEn: string;
    nameHi: string;
    aliasesEn: string;
    aliasesHi: string;
    descriptionEn: string;
    descriptionHi: string;
    order: string;
};

type Notice = {
    type: "success" | "error";
    message: string;
} | null;

const emptyCatalogForm: CatalogForm = {
    slug: "",
    nameEn: "",
    nameHi: "",
    aliasesEn: "",
    aliasesHi: "",
    descriptionEn: "",
    descriptionHi: "",
    order: "0",
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const parseStoredProfile = (value: string | null): AdminProfile | null => {
    if (!value) {
        return null;
    }

    try {
        const parsed = JSON.parse(value) as AdminProfile;

        if (!parsed || typeof parsed !== "object") {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
};

const getApiProfile = (result: AuthMeResponse): AdminProfile | null => {
    if (result.user && typeof result.user === "object") {
        return result.user;
    }

    if (result.data && typeof result.data === "object") {
        if ("user" in result.data && result.data.user) {
            return result.data.user;
        }

        if ("role" in result.data) {
            return result.data as AdminProfile;
        }
    }

    return null;
};

const parseCommaSeparatedValues = (value: string) => {
    const values = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    return Array.from(new Set(values));
};

const joinAliases = (values?: string[]) =>
    Array.isArray(values) ? values.join(", ") : "";

const nodeToForm = (node: ExamCatalogNode): CatalogForm => ({
    slug: node.slug || "",
    nameEn: node.nameEn || "",
    nameHi: node.nameHi || "",
    aliasesEn: joinAliases(node.aliasesEn),
    aliasesHi: joinAliases(node.aliasesHi),
    descriptionEn: node.descriptionEn || "",
    descriptionHi: node.descriptionHi || "",
    order: String(node.order ?? 0),
});

const validateForm = (form: CatalogForm) => {
    const slug = form.slug.trim().toLowerCase();
    const nameEn = form.nameEn.trim();
    const nameHi = form.nameHi.trim();

    if (!slug) {
        return "Slug is required.";
    }

    if (!SLUG_PATTERN.test(slug)) {
        return "Slug may contain only lowercase letters, numbers, and single hyphens.";
    }

    if (!nameEn && !nameHi) {
        return "Enter at least an English or Hindi name.";
    }

    const order = Number(form.order);

    if (!Number.isFinite(order) || order < 0) {
        return "Display order must be a non-negative number.";
    }

    return "";
};

const buildMetadataPayload = (form: CatalogForm) => ({
    slug: form.slug.trim().toLowerCase(),
    nameEn: form.nameEn.trim(),
    nameHi: form.nameHi.trim(),
    aliasesEn: parseCommaSeparatedValues(form.aliasesEn),
    aliasesHi: parseCommaSeparatedValues(form.aliasesHi),
    descriptionEn: form.descriptionEn.trim(),
    descriptionHi: form.descriptionHi.trim(),
    order: Number(form.order),
});

const getNodeDisplayName = (node: ExamCatalogNode) =>
    node.nameEn || node.nameHi || node.slug;

const getInactiveCount = (families: ExamFamily[]) => {
    let count = 0;

    for (const family of families) {
        if (family.isActive === false) {
            count += 1;
        }

        for (const exam of family.exams || []) {
            if (exam.isActive === false) {
                count += 1;
            }
        }
    }

    return count;
};

export default function ExamCatalogPage() {
    const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
    const [message, setMessage] = useState("");
    const [catalog, setCatalog] = useState<ExamFamily[]>([]);
    const [isCatalogLoading, setIsCatalogLoading] = useState(false);
    const [catalogError, setCatalogError] = useState("");
    const [includeInactive, setIncludeInactive] = useState(false);

    const [notice, setNotice] = useState<Notice>(null);

    const [isFamilyFormOpen, setIsFamilyFormOpen] = useState(false);
    const [editingFamilyId, setEditingFamilyId] = useState("");
    const [familyForm, setFamilyForm] =
        useState<CatalogForm>(emptyCatalogForm);
    const [familyFormError, setFamilyFormError] = useState("");
    const [isSavingFamily, setIsSavingFamily] = useState(false);

    const [examFamilyId, setExamFamilyId] = useState("");
    const [editingExamId, setEditingExamId] = useState("");
    const [examForm, setExamForm] =
        useState<CatalogForm>(emptyCatalogForm);
    const [examFormError, setExamFormError] = useState("");
    const [isSavingExam, setIsSavingExam] = useState(false);

    const [actionKey, setActionKey] = useState("");

    const familyCount = catalog.length;

    const examCount = useMemo(
        () =>
            catalog.reduce(
                (total, family) =>
                    total + (family.exams?.length || 0),
                0
            ),
        [catalog]
    );

    const inactiveCount = useMemo(
        () => getInactiveCount(catalog),
        [catalog]
    );

    const selectedExamFamily = useMemo(
        () =>
            catalog.find(
                (family) => family._id === examFamilyId
            ) || null,
        [catalog, examFamilyId]
    );

    const handleUnauthorized = useCallback((apiMessage?: string) => {
        clearAdminSessionStorage();
        setIsAllowed(false);
        setCatalog([]);
        setMessage(
            apiMessage ||
                "Your admin session has expired. Please login again."
        );
    }, []);

    const loadCatalog = useCallback(
        async (savedToken: string, showInactive: boolean) => {
            setIsCatalogLoading(true);
            setCatalogError("");

            try {
                const queryString = showInactive
                    ? "?includeInactive=true"
                    : "";

                const response = await fetch(
                    API_BASE_URL +
                        "/api/exam-taxonomy" +
                        queryString,
                    {
                        headers: {
                            Authorization:
                                "Bearer " + savedToken,
                        },
                    }
                );

                const result =
                    (await response.json()) as ExamCatalogResponse;

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    handleUnauthorized(result.message);
                    return;
                }

                if (!response.ok || result.success === false) {
                    throw new Error(
                        result.message ||
                            "Unable to load the exam catalog."
                    );
                }

                setCatalog(
                    Array.isArray(result.data)
                        ? result.data
                        : []
                );
            } catch (error) {
                setCatalogError(
                    error instanceof Error
                        ? error.message
                        : "Unable to load the exam catalog."
                );
            } finally {
                setIsCatalogLoading(false);
            }
        },
        [handleUnauthorized]
    );

    useEffect(() => {
        let cancelled = false;

        const verifyAdminSession = async () => {
            const savedToken =
                window.localStorage.getItem(
                    ADMIN_TOKEN_STORAGE_KEY
                ) || "";

            const storedProfile = parseStoredProfile(
                window.localStorage.getItem(
                    ADMIN_PROFILE_STORAGE_KEY
                )
            );

            if (!savedToken) {
                setIsAllowed(false);
                setMessage(
                    "Admin login is required to access this page."
                );
                return;
            }

            try {
                const response = await fetch(
                    API_BASE_URL + "/api/auth/me",
                    {
                        headers: {
                            Authorization:
                                "Bearer " + savedToken,
                        },
                    }
                );

                const result =
                    (await response.json()) as AuthMeResponse;

                if (cancelled) {
                    return;
                }

                if (
                    response.status === 401 ||
                    response.status === 403 ||
                    !response.ok
                ) {
                    clearAdminSessionStorage();
                    setIsAllowed(false);
                    setMessage(
                        result.message ||
                            "Your admin session has expired. Please login again."
                    );
                    return;
                }

                const apiProfile = getApiProfile(result);
                const role =
                    apiProfile?.role ||
                    storedProfile?.role ||
                    "";

                if (!ALLOWED_ADMIN_ROLES.includes(role)) {
                    clearAdminSessionStorage();
                    setIsAllowed(false);
                    setMessage(
                        "This page is available only to authorized administrators."
                    );
                    return;
                }

                setIsAllowed(true);
                setMessage("");
                void loadCatalog(savedToken, false);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                clearAdminSessionStorage();
                setIsAllowed(false);
                setMessage(
                    error instanceof Error
                        ? error.message
                        : "Unable to verify the admin session."
                );
            }
        };

        void verifyAdminSession();

        return () => {
            cancelled = true;
        };
    }, [loadCatalog]);

    const refreshCatalog = () => {
        const savedToken =
            window.localStorage.getItem(
                ADMIN_TOKEN_STORAGE_KEY
            ) || "";

        if (!savedToken) {
            handleUnauthorized();
            return;
        }

        setNotice(null);
        void loadCatalog(savedToken, includeInactive);
    };

    const handleToggleIncludeInactive = (checked: boolean) => {
        setIncludeInactive(checked);
        setNotice(null);

        const savedToken =
            window.localStorage.getItem(
                ADMIN_TOKEN_STORAGE_KEY
            ) || "";

        if (!savedToken) {
            handleUnauthorized();
            return;
        }

        void loadCatalog(savedToken, checked);
    };

    const openCreateFamily = () => {
        setExamFamilyId("");
        setEditingExamId("");
        setExamForm(emptyCatalogForm);
        setExamFormError("");

        setEditingFamilyId("");
        setFamilyForm(emptyCatalogForm);
        setFamilyFormError("");
        setIsFamilyFormOpen(true);
        setNotice(null);
    };

    const openEditFamily = (family: ExamFamily) => {
        setExamFamilyId("");
        setEditingExamId("");
        setExamForm(emptyCatalogForm);
        setExamFormError("");

        setEditingFamilyId(family._id);
        setFamilyForm(nodeToForm(family));
        setFamilyFormError("");
        setIsFamilyFormOpen(true);
        setNotice(null);
    };

    const closeFamilyForm = () => {
        if (isSavingFamily) {
            return;
        }

        setIsFamilyFormOpen(false);
        setEditingFamilyId("");
        setFamilyForm(emptyCatalogForm);
        setFamilyFormError("");
    };

    const openCreateExam = (family: ExamFamily) => {
        setIsFamilyFormOpen(false);
        setEditingFamilyId("");
        setFamilyForm(emptyCatalogForm);
        setFamilyFormError("");

        setExamFamilyId(family._id);
        setEditingExamId("");
        setExamForm(emptyCatalogForm);
        setExamFormError("");
        setNotice(null);
    };

    const openEditExam = (
        family: ExamFamily,
        exam: ExamCatalogNode
    ) => {
        setIsFamilyFormOpen(false);
        setEditingFamilyId("");
        setFamilyForm(emptyCatalogForm);
        setFamilyFormError("");

        setExamFamilyId(family._id);
        setEditingExamId(exam._id);
        setExamForm(nodeToForm(exam));
        setExamFormError("");
        setNotice(null);
    };

    const closeExamForm = () => {
        if (isSavingExam) {
            return;
        }

        setExamFamilyId("");
        setEditingExamId("");
        setExamForm(emptyCatalogForm);
        setExamFormError("");
    };

    const saveFamily = async () => {
        if (isSavingFamily) {
            return;
        }

        const validationError =
            validateForm(familyForm);

        if (validationError) {
            setFamilyFormError(validationError);
            return;
        }

        const savedToken =
            window.localStorage.getItem(
                ADMIN_TOKEN_STORAGE_KEY
            ) || "";

        if (!savedToken) {
            handleUnauthorized();
            return;
        }

        setIsSavingFamily(true);
        setFamilyFormError("");
        setNotice(null);

        try {
            const isEditing = Boolean(editingFamilyId);

            const response = await fetch(
                isEditing
                    ? API_BASE_URL +
                          "/api/exam-taxonomy/families/" +
                          editingFamilyId
                    : API_BASE_URL +
                          "/api/exam-taxonomy/families",
                {
                    method: isEditing ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization:
                            "Bearer " + savedToken,
                    },
                    body: JSON.stringify(
                        buildMetadataPayload(familyForm)
                    ),
                }
            );

            const result =
                (await response.json()) as MutationResponse;

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                handleUnauthorized(result.message);
                return;
            }

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message ||
                        (isEditing
                            ? "Unable to update the exam family."
                            : "Unable to create the exam family.")
                );
            }

            setNotice({
                type: "success",
                message: isEditing
                    ? "Exam family updated successfully."
                    : "Exam family created successfully.",
            });

            setIsFamilyFormOpen(false);
            setEditingFamilyId("");
            setFamilyForm(emptyCatalogForm);

            await loadCatalog(
                savedToken,
                includeInactive
            );
        } catch (error) {
            setFamilyFormError(
                error instanceof Error
                    ? error.message
                    : "Unable to save the exam family."
            );
        } finally {
            setIsSavingFamily(false);
        }
    };

    const saveExam = async () => {
        if (
            isSavingExam ||
            !examFamilyId
        ) {
            return;
        }

        const validationError =
            validateForm(examForm);

        if (validationError) {
            setExamFormError(validationError);
            return;
        }

        const savedToken =
            window.localStorage.getItem(
                ADMIN_TOKEN_STORAGE_KEY
            ) || "";

        if (!savedToken) {
            handleUnauthorized();
            return;
        }

        setIsSavingExam(true);
        setExamFormError("");
        setNotice(null);

        try {
            const isEditing = Boolean(editingExamId);

            const response = await fetch(
                isEditing
                    ? API_BASE_URL +
                          "/api/exam-taxonomy/exams/" +
                          editingExamId
                    : API_BASE_URL +
                          "/api/exam-taxonomy/families/" +
                          examFamilyId +
                          "/exams",
                {
                    method: isEditing ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization:
                            "Bearer " + savedToken,
                    },
                    body: JSON.stringify(
                        buildMetadataPayload(examForm)
                    ),
                }
            );

            const result =
                (await response.json()) as MutationResponse;

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                handleUnauthorized(result.message);
                return;
            }

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message ||
                        (isEditing
                            ? "Unable to update the exam."
                            : "Unable to create the exam.")
                );
            }

            setNotice({
                type: "success",
                message: isEditing
                    ? "Exam updated successfully."
                    : "Exam created successfully.",
            });

            setExamFamilyId("");
            setEditingExamId("");
            setExamForm(emptyCatalogForm);

            await loadCatalog(
                savedToken,
                includeInactive
            );
        } catch (error) {
            setExamFormError(
                error instanceof Error
                    ? error.message
                    : "Unable to save the exam."
            );
        } finally {
            setIsSavingExam(false);
        }
    };

    const changeFamilyStatus = async (
        family: ExamFamily
    ) => {
        const targetStatus =
            family.isActive === false;

        const confirmed = window.confirm(
            targetStatus
                ? `Activate "${getNodeDisplayName(
                      family
                  )}"?`
                : `Deactivate "${getNodeDisplayName(
                      family
                  )}"? Active child exams or linked mock tests may prevent this action.`
        );

        if (!confirmed) {
            return;
        }

        const savedToken =
            window.localStorage.getItem(
                ADMIN_TOKEN_STORAGE_KEY
            ) || "";

        if (!savedToken) {
            handleUnauthorized();
            return;
        }

        const currentActionKey =
            "family:" + family._id;

        setActionKey(currentActionKey);
        setNotice(null);

        try {
            const response = await fetch(
                API_BASE_URL +
                    "/api/exam-taxonomy/families/" +
                    family._id +
                    "/status",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization:
                            "Bearer " + savedToken,
                    },
                    body: JSON.stringify({
                        isActive: targetStatus,
                    }),
                }
            );

            const result =
                (await response.json()) as MutationResponse;

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                handleUnauthorized(result.message);
                return;
            }

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message ||
                        "Unable to update exam family status."
                );
            }

            setNotice({
                type: "success",
                message:
                    result.message ||
                    (targetStatus
                        ? "Exam family activated."
                        : "Exam family deactivated."),
            });

            await loadCatalog(
                savedToken,
                includeInactive
            );
        } catch (error) {
            setNotice({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to update exam family status.",
            });
        } finally {
            setActionKey("");
        }
    };

    const changeExamStatus = async (
        exam: ExamCatalogNode
    ) => {
        const targetStatus =
            exam.isActive === false;

        const confirmed = window.confirm(
            targetStatus
                ? `Activate "${getNodeDisplayName(
                      exam
                  )}"? Its parent Exam Family must already be active.`
                : `Deactivate "${getNodeDisplayName(
                      exam
                  )}"? Active linked mock tests may prevent this action.`
        );

        if (!confirmed) {
            return;
        }

        const savedToken =
            window.localStorage.getItem(
                ADMIN_TOKEN_STORAGE_KEY
            ) || "";

        if (!savedToken) {
            handleUnauthorized();
            return;
        }

        const currentActionKey =
            "exam:" + exam._id;

        setActionKey(currentActionKey);
        setNotice(null);

        try {
            const response = await fetch(
                API_BASE_URL +
                    "/api/exam-taxonomy/exams/" +
                    exam._id +
                    "/status",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization:
                            "Bearer " + savedToken,
                    },
                    body: JSON.stringify({
                        isActive: targetStatus,
                    }),
                }
            );

            const result =
                (await response.json()) as MutationResponse;

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                handleUnauthorized(result.message);
                return;
            }

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message ||
                        "Unable to update exam status."
                );
            }

            setNotice({
                type: "success",
                message:
                    result.message ||
                    (targetStatus
                        ? "Exam activated."
                        : "Exam deactivated."),
            });

            await loadCatalog(
                savedToken,
                includeInactive
            );
        } catch (error) {
            setNotice({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to update exam status.",
            });
        } finally {
            setActionKey("");
        }
    };

    if (isAllowed === null) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
                <section className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold text-slate-600">
                        Verifying admin session...
                    </p>
                </section>
            </main>
        );
    }

    if (!isAllowed) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
                <section className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-600">
                        Access unavailable
                    </p>

                    <h1 className="mt-3 text-3xl font-bold">
                        Exam Catalog
                    </h1>

                    <p className="mt-4 text-sm leading-6 text-slate-600">
                        {message ||
                            "Please login again with an authorized admin account."}
                    </p>

                    <Link
                        href="/admin/login"
                        className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                        Admin Login
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-6">
                {notice ? (
                    <div
                        role="status"
                        className={
                            "fixed left-4 right-4 top-4 z-50 mx-auto max-w-xl rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg lg:left-auto lg:right-6 lg:mx-0 lg:w-[440px] " +
                            (notice.type === "error"
                                ? "border-red-100 bg-red-50 text-red-700"
                                : "border-emerald-100 bg-emerald-50 text-emerald-700")
                        }
                    >
                        <div className="flex items-start justify-between gap-4">
                            <span>{notice.message}</span>

                            <button
                                type="button"
                                onClick={() => setNotice(null)}
                                className="shrink-0 text-xs font-bold uppercase tracking-wide"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                ) : null}

                <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
                                Mock-Test Admin
                            </p>

                            <h1 className="mt-2 text-3xl font-bold">
                                Exam Catalog
                            </h1>

                            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                                Manage the Exam Family → Exam hierarchy used
                                to organize mock tests and PYQs. Internal
                                taxonomy keys and ownership fields remain
                                protected by the backend.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={refreshCatalog}
                                disabled={isCatalogLoading}
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                            >
                                {isCatalogLoading
                                    ? "Refreshing..."
                                    : "Refresh"}
                            </button>

                            <button
                                type="button"
                                onClick={openCreateFamily}
                                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                + Add Exam Family
                            </button>
                        </div>
                    </div>
                </header>

                <section className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Exam Families
                        </p>
                        <p className="mt-2 text-3xl font-black">
                            {familyCount}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Exams
                        </p>
                        <p className="mt-2 text-3xl font-black">
                            {examCount}
                        </p>
                    </div>

                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Inactive Loaded
                        </p>
                        <p className="mt-2 text-3xl font-black">
                            {inactiveCount}
                        </p>
                    </div>
                </section>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Catalog Scope
                            </p>
                            <p className="mt-2 text-sm text-slate-600">
                                Active entries are shown by default.
                            </p>
                        </div>

                        <label className="flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                            <input
                                type="checkbox"
                                checked={includeInactive}
                                onChange={(event) =>
                                    handleToggleIncludeInactive(
                                        event.target.checked
                                    )
                                }
                            />
                            Show inactive
                        </label>
                    </div>
                </section>

                {isFamilyFormOpen ? (
                    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                    Exam Family
                                </p>

                                <h2 className="mt-2 text-2xl font-bold">
                                    {editingFamilyId
                                        ? "Edit Exam Family"
                                        : "Create Exam Family"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={closeFamilyForm}
                                disabled={isSavingFamily}
                                className="w-fit rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                            >
                                Cancel
                            </button>
                        </div>

                        <CatalogFormFields
                            form={familyForm}
                            setForm={setFamilyForm}
                        />

                        {familyFormError ? (
                            <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                                {familyFormError}
                            </div>
                        ) : null}

                        <button
                            type="button"
                            onClick={() => void saveFamily()}
                            disabled={isSavingFamily}
                            className="mt-5 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            {isSavingFamily
                                ? "Saving..."
                                : editingFamilyId
                                  ? "Save Family Changes"
                                  : "Create Exam Family"}
                        </button>
                    </section>
                ) : null}

                {examFamilyId ? (
                    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                    Exam
                                </p>

                                <h2 className="mt-2 text-2xl font-bold">
                                    {editingExamId
                                        ? "Edit Exam"
                                        : "Add Exam"}
                                </h2>

                                <p className="mt-2 text-sm text-slate-600">
                                    Parent family:{" "}
                                    <span className="font-semibold text-slate-900">
                                        {selectedExamFamily
                                            ? getNodeDisplayName(
                                                  selectedExamFamily
                                              )
                                            : "Selected family"}
                                    </span>
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeExamForm}
                                disabled={isSavingExam}
                                className="w-fit rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                            >
                                Cancel
                            </button>
                        </div>

                        <CatalogFormFields
                            form={examForm}
                            setForm={setExamForm}
                        />

                        {examFormError ? (
                            <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                                {examFormError}
                            </div>
                        ) : null}

                        <button
                            type="button"
                            onClick={() => void saveExam()}
                            disabled={isSavingExam}
                            className="mt-5 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            {isSavingExam
                                ? "Saving..."
                                : editingExamId
                                  ? "Save Exam Changes"
                                  : "Add Exam"}
                        </button>
                    </section>
                ) : null}

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Exam Catalog
                            </p>

                            <h2 className="mt-2 text-xl font-bold">
                                Exam Family → Exam
                            </h2>
                        </div>

                        <p className="text-sm font-semibold text-slate-500">
                            {includeInactive
                                ? "Active and inactive"
                                : "Active only"}
                        </p>
                    </div>

                    {catalogError ? (
                        <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                            {catalogError}
                        </div>
                    ) : null}

                    {isCatalogLoading && catalog.length === 0 ? (
                        <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                            Loading exam catalog...
                        </div>
                    ) : null}

                    {!isCatalogLoading &&
                    !catalogError &&
                    catalog.length === 0 ? (
                        <div className="mt-5 rounded-2xl bg-blue-50 p-5 text-sm text-blue-900 ring-1 ring-blue-100">
                            No exam families are available in this scope yet.
                            Create the first Exam Family to start organizing
                            exams.
                        </div>
                    ) : null}

                    <div className="mt-5 space-y-5">
                        {catalog.map((family) => (
                            <article
                                key={family._id}
                                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                            >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-xl font-bold text-slate-950">
                                                {getNodeDisplayName(
                                                    family
                                                )}
                                            </h3>

                                            <span
                                                className={
                                                    family.isActive === false
                                                        ? "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100"
                                                        : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"
                                                }
                                            >
                                                {family.isActive === false
                                                    ? "Inactive"
                                                    : "Active"}
                                            </span>

                                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                                {family.exams?.length || 0}{" "}
                                                exams
                                            </span>
                                        </div>

                                        {family.nameHi ? (
                                            <p className="mt-2 font-semibold text-slate-700">
                                                {family.nameHi}
                                            </p>
                                        ) : null}

                                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
                                                slug: {family.slug}
                                            </span>

                                            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
                                                order:{" "}
                                                {family.order ?? 0}
                                            </span>
                                        </div>

                                        {family.descriptionEn ? (
                                            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                                                {family.descriptionEn}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openCreateExam(
                                                    family
                                                )
                                            }
                                            disabled={
                                                family.isActive ===
                                                false
                                            }
                                            className="rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                        >
                                            + Add Exam
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                openEditFamily(
                                                    family
                                                )
                                            }
                                            className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Edit
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                void changeFamilyStatus(
                                                    family
                                                )
                                            }
                                            disabled={
                                                Boolean(
                                                    actionKey
                                                ) ||
                                                isCatalogLoading
                                            }
                                            className={
                                                family.isActive ===
                                                false
                                                    ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                                    : "rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                            }
                                        >
                                            {actionKey ===
                                            "family:" +
                                                family._id
                                                ? "Updating..."
                                                : family.isActive ===
                                                    false
                                                  ? "Activate"
                                                  : "Deactivate"}
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-5 border-t border-slate-200 pt-5">
                                    {family.exams?.length ? (
                                        <div className="grid gap-3 lg:grid-cols-2">
                                            {family.exams.map(
                                                (exam) => (
                                                    <div
                                                        key={
                                                            exam._id
                                                        }
                                                        className="rounded-2xl border border-slate-200 bg-white p-4"
                                                    >
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <h4 className="font-bold text-slate-900">
                                                                        {getNodeDisplayName(
                                                                            exam
                                                                        )}
                                                                    </h4>

                                                                    <span
                                                                        className={
                                                                            exam.isActive ===
                                                                            false
                                                                                ? "rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700"
                                                                                : "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                                                                        }
                                                                    >
                                                                        {exam.isActive ===
                                                                        false
                                                                            ? "Inactive"
                                                                            : "Active"}
                                                                    </span>
                                                                </div>

                                                                {exam.nameHi ? (
                                                                    <p className="mt-1 text-sm font-semibold text-slate-600">
                                                                        {
                                                                            exam.nameHi
                                                                        }
                                                                    </p>
                                                                ) : null}

                                                                <p className="mt-2 text-xs text-slate-500">
                                                                    {
                                                                        exam.slug
                                                                    }{" "}
                                                                    · order{" "}
                                                                    {exam.order ??
                                                                        0}
                                                                </p>
                                                            </div>

                                                            <div className="flex shrink-0 flex-wrap gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        openEditExam(
                                                                            family,
                                                                            exam
                                                                        )
                                                                    }
                                                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                                >
                                                                    Edit
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void changeExamStatus(
                                                                            exam
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        Boolean(
                                                                            actionKey
                                                                        ) ||
                                                                        isCatalogLoading
                                                                    }
                                                                    className={
                                                                        exam.isActive ===
                                                                        false
                                                                            ? "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                                                            : "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                                                    }
                                                                >
                                                                    {actionKey ===
                                                                    "exam:" +
                                                                        exam._id
                                                                        ? "Updating..."
                                                                        : exam.isActive ===
                                                                            false
                                                                          ? "Activate"
                                                                          : "Deactivate"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
                                            No exams are currently loaded
                                            under this family.
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <div className="flex flex-wrap gap-3 pb-6">
                    <Link
                        href="/admin/dashboard"
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Back to Dashboard
                    </Link>

                    <Link
                        href="/admin/mock-tests/exam-patterns"
                        className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                        Exam Patterns
                    </Link>
                </div>
            </div>
        </main>
    );
}

function CatalogFormFields({
    form,
    setForm,
}: {
    form: CatalogForm;
    setForm: (
        value:
            | CatalogForm
            | ((current: CatalogForm) => CatalogForm)
    ) => void;
}) {
    return (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
                English Name
                <input
                    type="text"
                    value={form.nameEn}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            nameEn: event.target.value,
                        }))
                    }
                    placeholder="e.g. Staff Selection Commission"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                />
            </label>

            <label className="text-sm font-semibold text-slate-700">
                Hindi Name
                <input
                    type="text"
                    value={form.nameHi}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            nameHi: event.target.value,
                        }))
                    }
                    placeholder="उदाहरण: कर्मचारी चयन आयोग"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                />
            </label>

            <label className="text-sm font-semibold text-slate-700">
                Slug
                <input
                    type="text"
                    value={form.slug}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            slug: event.target.value
                                .toLowerCase()
                                .replace(/\s+/g, "-"),
                        }))
                    }
                    placeholder="e.g. ssc"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                    Lowercase letters, numbers and single hyphens only.
                </span>
            </label>

            <label className="text-sm font-semibold text-slate-700">
                Display Order
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.order}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            order: event.target.value,
                        }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                />
            </label>

            <label className="text-sm font-semibold text-slate-700">
                English Aliases
                <input
                    type="text"
                    value={form.aliasesEn}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            aliasesEn: event.target.value,
                        }))
                    }
                    placeholder="SSC, Staff Selection"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                    Separate multiple aliases with commas.
                </span>
            </label>

            <label className="text-sm font-semibold text-slate-700">
                Hindi Aliases
                <input
                    type="text"
                    value={form.aliasesHi}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            aliasesHi: event.target.value,
                        }))
                    }
                    placeholder="एसएससी, कर्मचारी चयन"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                    Separate multiple aliases with commas.
                </span>
            </label>

            <label className="text-sm font-semibold text-slate-700">
                English Description
                <textarea
                    value={form.descriptionEn}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            descriptionEn:
                                event.target.value,
                        }))
                    }
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                />
            </label>

            <label className="text-sm font-semibold text-slate-700">
                Hindi Description
                <textarea
                    value={form.descriptionHi}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            descriptionHi:
                                event.target.value,
                        }))
                    }
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                />
            </label>
        </div>
    );
}
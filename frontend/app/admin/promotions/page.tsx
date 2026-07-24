"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";

const ADMIN_TOKEN_STORAGE_KEY =
  "pravixoAdminToken";

const ADMIN_PROFILE_STORAGE_KEY =
  "pravixoAdminProfile";

const PROMOTION_ADMIN_ROLES = [
  "super_admin",
  "tenant_admin",
] as const;

type PromotionPlacement =
  | "home_hero"
  | "exams_hero"
  | "study_notes_hero"
  | "current_affairs_hero"
  | "jobs_hero"
  | "mock_tests_hero";

type PromotionStatus =
  | "draft"
  | "active"
  | "inactive";

type AdminProfile = {
  id?: string;
  name?: string;
  email?: string;
  mobile?: string;
  tenantId?: string;
  role?: string;
};

type MeResponse = {
  success: boolean;
  message?: string;
  data?: AdminProfile;
};

type SitePromotion = {
  _id: string;
  tenantId?: string;
  placement: PromotionPlacement;
  title: string;
  subtitle?: string;
  badgeText?: string;
  imageUrl?: string;
  ctaLabel: string;
  ctaUrl: string;
  status: PromotionStatus;
  priority: number;
  startAt?: string | null;
  endAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type PromotionsResponse = {
  success: boolean;
  message?: string;
  total?: number;
  data?: SitePromotion[];
};

type PromotionMutationResponse = {
  success: boolean;
  message?: string;
  data?: SitePromotion;
};

type ToastState = {
  type: "success" | "error";
  message: string;
};

type PromotionForm = {
  placement: PromotionPlacement;
  title: string;
  subtitle: string;
  badgeText: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  status: PromotionStatus;
  priority: string;
  startAt: string;
  endAt: string;
};

const placementOptions: Array<{
  value: PromotionPlacement;
  label: string;
}> = [
  {
    value: "home_hero",
    label: "Home Hero",
  },
  {
    value: "exams_hero",
    label: "Exams Hero",
  },
  {
    value: "study_notes_hero",
    label: "Study Notes Hero",
  },
  {
    value: "current_affairs_hero",
    label: "Current Affairs Hero",
  },
  {
    value: "jobs_hero",
    label: "Jobs Hero",
  },
  {
    value: "mock_tests_hero",
    label: "Mock Tests Hero",
  },
];

const initialForm: PromotionForm = {
  placement: "home_hero",
  title: "",
  subtitle: "",
  badgeText: "",
  imageUrl: "",
  ctaLabel: "Explore Now",
  ctaUrl: "/",
  status: "draft",
  priority: "0",
  startAt: "",
  endAt: "",
};

const isPromotionAdminRole = (
  role?: string
) => {
  return Boolean(
    role &&
      PROMOTION_ADMIN_ROLES.includes(
        role as
          (typeof PROMOTION_ADMIN_ROLES)[number]
      )
  );
};

const clearAdminSessionStorage = () => {
  window.localStorage.removeItem(
    ADMIN_TOKEN_STORAGE_KEY
  );

  window.localStorage.removeItem(
    ADMIN_PROFILE_STORAGE_KEY
  );
};

const formatPlacement = (
  placement: PromotionPlacement
) => {
  return (
    placementOptions.find(
      (option) => option.value === placement
    )?.label || placement
  );
};

const formatDateTime = (
  value?: string | null
) => {
  if (!value) {
    return "No limit";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const toApiDate = (
  value: string
) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
};

const statusClasses = (
  status: PromotionStatus
) => {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "inactive") {
    return "bg-slate-200 text-slate-700";
  }

  return "bg-amber-100 text-amber-800";
};

export default function AdminPromotionsPage() {
  const [profile, setProfile] =
    useState<AdminProfile | null>(null);

  const [adminToken, setAdminToken] =
    useState("");

  const [isAllowed, setIsAllowed] =
    useState(false);

  const [isReady, setIsReady] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [toast, setToast] =
    useState<ToastState | null>(null);

  const [promotions, setPromotions] =
    useState<SitePromotion[]>([]);

  const [form, setForm] =
    useState<PromotionForm>(initialForm);

  const activeCount = useMemo(
    () =>
      promotions.filter(
        (promotion) =>
          promotion.status === "active"
      ).length,
    [promotions]
  );

  const draftCount = useMemo(
    () =>
      promotions.filter(
        (promotion) =>
          promotion.status === "draft"
      ).length,
    [promotions]
  );

  const updateForm = (
    field: keyof PromotionForm,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const loadPromotions = async (
    token: string
  ) => {
    setIsLoading(true);

    try {
      const response = await fetch(
        API_BASE_URL + "/api/promotions/admin",
        {
          headers: {
            Authorization:
              "Bearer " + token,
          },
        }
      );

      const result =
        (await response.json()) as
          PromotionsResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "Unable to load promotions."
        );
      }

      setPromotions(
        Array.isArray(result.data)
          ? result.data
          : []
      );
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load promotions.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const verifyAdminSession = async () => {
      const savedToken =
        window.localStorage.getItem(
          ADMIN_TOKEN_STORAGE_KEY
        ) || "";

      if (!savedToken) {
        clearAdminSessionStorage();
        setMessage(
          "Please login with an admin account."
        );
        setIsReady(true);
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
          (await response.json()) as
            MeResponse;

        if (
          !response.ok ||
          !result.success ||
          !result.data
        ) {
          throw new Error(
            result.message ||
              "Admin session is invalid."
          );
        }

        if (
          !isPromotionAdminRole(
            result.data.role
          )
        ) {
          setProfile(result.data);
          setAdminToken(savedToken);
          setIsAllowed(false);
          setMessage(
            "Promotions can be managed only by Admin or Super Admin."
          );
          return;
        }

        window.localStorage.setItem(
          ADMIN_PROFILE_STORAGE_KEY,
          JSON.stringify(result.data)
        );

        setProfile(result.data);
        setAdminToken(savedToken);
        setIsAllowed(true);
        setMessage("");

        await loadPromotions(savedToken);
      } catch (error) {
        clearAdminSessionStorage();
        setAdminToken("");
        setProfile(null);
        setIsAllowed(false);

        setMessage(
          error instanceof Error
            ? error.message
            : "Admin session is invalid."
        );
      } finally {
        setIsReady(true);
      }
    };

    void verifyAdminSession();
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        setToast(null);
      }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const validateForm = () => {
    if (!form.title.trim()) {
      return "Promotion title is required.";
    }

    if (!form.ctaLabel.trim()) {
      return "CTA label is required.";
    }

    if (
      !form.ctaUrl.trim().startsWith("/") ||
      form.ctaUrl.trim().startsWith("//")
    ) {
      return "CTA URL must be an internal path beginning with /.";
    }

    if (
      form.imageUrl.trim() &&
      !form.imageUrl.trim().startsWith(
        "https://"
      )
    ) {
      return "Image URL must use HTTPS.";
    }

    const priority =
      Number(form.priority);

    if (
      !Number.isInteger(priority) ||
      priority < 0 ||
      priority > 1000
    ) {
      return "Priority must be an integer from 0 to 1000.";
    }

    if (
      form.startAt &&
      form.endAt &&
      new Date(form.endAt).getTime() <
        new Date(form.startAt).getTime()
    ) {
      return "End date must be on or after start date.";
    }

    return "";
  };

  const handleCreate = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!adminToken) {
      return;
    }

    setToast(null);

    const validationError =
      validateForm();

    if (validationError) {
      setToast({
        type: "error",
        message: validationError,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        API_BASE_URL + "/api/promotions",
        {
          method: "POST",
          headers: {
            Authorization:
              "Bearer " + adminToken,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            placement: form.placement,
            title: form.title.trim(),
            subtitle: form.subtitle.trim(),
            badgeText:
              form.badgeText.trim(),
            imageUrl:
              form.imageUrl.trim(),
            ctaLabel:
              form.ctaLabel.trim(),
            ctaUrl:
              form.ctaUrl.trim(),
            status: form.status,
            priority:
              Number(form.priority),
            startAt:
              toApiDate(form.startAt),
            endAt:
              toApiDate(form.endAt),
          }),
        }
      );

      const result =
        (await response.json()) as
          PromotionMutationResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "Unable to create promotion."
        );
      }

      setForm(initialForm);

      setToast({
        type: "success",
        message:
          "Promotion created successfully.",
      });

      await loadPromotions(adminToken);
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to create promotion.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isReady) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          Loading promotions...
        </div>
      </main>
    );
  }

  if (
    !adminToken ||
    !profile ||
    !isAllowed
  ) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
            Promotions
          </p>

          <h1 className="mt-3 text-2xl font-bold">
            Access restricted
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {message ||
              "Please login with an Admin or Super Admin account."}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/admin/login"
              className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Go to Admin Login
            </Link>

            <Link
              href="/admin/dashboard"
              className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
                Public Marketing
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Site Promotions
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Create scheduled promotional cards for public hero areas.
                One active promotion will later be selected for each placement by priority.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  void loadPromotions(
                    adminToken
                  )
                }
                disabled={isLoading}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <Link
                href="/admin/dashboard"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </header>

        {toast ? (
          <div
            className={
              "fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-3xl p-4 text-sm font-semibold shadow-2xl ring-1 " +
              (toast.type === "success"
                ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                : "bg-red-50 text-red-800 ring-red-100")
            }
          >
            <div className="flex items-start gap-3">
              <span className="flex-1">
                {toast.message}
              </span>

              <button
                type="button"
                onClick={() =>
                  setToast(null)
                }
                className="rounded-full px-2 text-xs font-bold hover:bg-white/70"
              >
                x
              </button>
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Total Promotions
            </p>
            <p className="mt-2 text-3xl font-bold">
              {promotions.length}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Active
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {activeCount}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Draft
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-700">
              {draftCount}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <form
            onSubmit={handleCreate}
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
              Create Promotion
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Campaign details
            </h2>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Placement
                </span>

                <select
                  value={form.placement}
                  onChange={(event) =>
                    updateForm(
                      "placement",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                >
                  {placementOptions.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Title
                </span>

                <input
                  value={form.title}
                  maxLength={120}
                  onChange={(event) =>
                    updateForm(
                      "title",
                      event.target.value
                    )
                  }
                  placeholder="Example: SSC CGL 2026 Mock Test Series"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Subtitle
                </span>

                <textarea
                  value={form.subtitle}
                  maxLength={300}
                  rows={3}
                  onChange={(event) =>
                    updateForm(
                      "subtitle",
                      event.target.value
                    )
                  }
                  placeholder="Short supporting message."
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Badge
                  </span>

                  <input
                    value={form.badgeText}
                    maxLength={50}
                    onChange={(event) =>
                      updateForm(
                        "badgeText",
                        event.target.value
                      )
                    }
                    placeholder="Featured"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Status
                  </span>

                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="draft">
                      Draft
                    </option>
                    <option value="active">
                      Active
                    </option>
                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Image URL
                </span>

                <input
                  type="url"
                  value={form.imageUrl}
                  maxLength={1000}
                  onChange={(event) =>
                    updateForm(
                      "imageUrl",
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    CTA label
                  </span>

                  <input
                    value={form.ctaLabel}
                    maxLength={60}
                    onChange={(event) =>
                      updateForm(
                        "ctaLabel",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Internal CTA path
                  </span>

                  <input
                    value={form.ctaUrl}
                    maxLength={1000}
                    onChange={(event) =>
                      updateForm(
                        "ctaUrl",
                        event.target.value
                      )
                    }
                    placeholder="/student/mock-tests"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Priority
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    value={form.priority}
                    onChange={(event) =>
                      updateForm(
                        "priority",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Starts
                  </span>

                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(event) =>
                      updateForm(
                        "startAt",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Ends
                  </span>

                  <input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(event) =>
                      updateForm(
                        "endAt",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? "Creating..."
                  : "Create Promotion"}
              </button>
            </div>
          </form>

          <div className="space-y-6">
            <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
                Live Preview · {formatPlacement(form.placement)}
              </p>

              {form.imageUrl.trim() ? (
                <div className="mt-5 overflow-hidden rounded-2xl bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imageUrl.trim()}
                    alt=""
                    className="aspect-[16/7] w-full object-cover"
                  />
                </div>
              ) : null}

              <div className="mt-5">
                {form.badgeText.trim() ? (
                  <span className="inline-flex rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-200">
                    {form.badgeText.trim()}
                  </span>
                ) : null}

                <h2 className="mt-3 text-2xl font-bold tracking-tight">
                  {form.title.trim() ||
                    "Your promotion title"}
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {form.subtitle.trim() ||
                    "Supporting promotional copy will appear here."}
                </p>

                <span className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950">
                  {form.ctaLabel.trim() ||
                    "Explore Now"}
                </span>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Scheduling
              </p>

              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>
                  Priority:{" "}
                  <strong className="text-slate-900">
                    {form.priority || "0"}
                  </strong>
                </p>

                <p>
                  Starts:{" "}
                  <strong className="text-slate-900">
                    {form.startAt
                      ? new Date(
                          form.startAt
                        ).toLocaleString()
                      : "Immediately"}
                  </strong>
                </p>

                <p>
                  Ends:{" "}
                  <strong className="text-slate-900">
                    {form.endAt
                      ? new Date(
                          form.endAt
                        ).toLocaleString()
                      : "No limit"}
                  </strong>
                </p>
              </div>
            </section>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
                Existing Promotions
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Campaign library
              </h2>
            </div>

            <p className="text-sm text-slate-500">
              Highest priority active promotion wins each placement.
            </p>
          </div>

          {isLoading &&
          promotions.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-sm text-slate-600">
              Loading promotions...
            </div>
          ) : promotions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="font-bold text-slate-900">
                No promotions created yet
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Create the first campaign above.
                Public pages will continue using their fallback hero until an active campaign is available.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {promotions.map(
                (promotion) => (
                  <article
                    key={promotion._id}
                    className="rounded-3xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                          {formatPlacement(
                            promotion.placement
                          )}
                        </p>

                        <h3 className="mt-2 text-lg font-bold text-slate-950">
                          {promotion.title}
                        </h3>
                      </div>

                      <span
                        className={
                          "rounded-full px-3 py-1 text-xs font-bold " +
                          statusClasses(
                            promotion.status
                          )
                        }
                      >
                        {promotion.status}
                      </span>
                    </div>

                    {promotion.subtitle ? (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {promotion.subtitle}
                      </p>
                    ) : null}

                    <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                      <p>
                        Priority:{" "}
                        <strong className="text-slate-800">
                          {promotion.priority}
                        </strong>
                      </p>

                      <p>
                        CTA:{" "}
                        <strong className="break-all text-slate-800">
                          {promotion.ctaUrl}
                        </strong>
                      </p>

                      <p>
                        Starts:{" "}
                        <strong className="text-slate-800">
                          {formatDateTime(
                            promotion.startAt
                          )}
                        </strong>
                      </p>

                      <p>
                        Ends:{" "}
                        <strong className="text-slate-800">
                          {formatDateTime(
                            promotion.endAt
                          )}
                        </strong>
                      </p>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                      Edit and status actions will be enabled in the next checkpoint.
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

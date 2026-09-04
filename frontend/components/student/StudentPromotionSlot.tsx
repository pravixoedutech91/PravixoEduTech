"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

export type StudentPromotionPlacement =
  | "student_dashboard_primary"
  | "student_dashboard_secondary";

type StudentPromotion = {
  _id: string;
  placement: StudentPromotionPlacement;
  title: string;
  subtitle?: string;
  badgeText?: string;
  imageUrl?: string;
  ctaLabel: string;
  ctaUrl: string;
  priority: number;
  startAt?: string | null;
  endAt?: string | null;
  updatedAt?: string;
};

type StudentPromotionResponse = {
  success: boolean;
  data?: StudentPromotion | null;
  message?: string;
};

type StudentPromotionSlotProps = {
  placement: StudentPromotionPlacement;
  token: string;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

export default function StudentPromotionSlot({
  placement,
  token,
}: StudentPromotionSlotProps) {
  const [loadedPromotion, setLoadedPromotion] =
    useState<{
      requestKey: string;
      promotion: StudentPromotion | null;
    }>({
      requestKey: "",
      promotion: null,
    });

  useEffect(() => {
    const cleanToken = token.trim();

    if (!API_BASE_URL || !cleanToken) {
      return;
    }

    const requestKey =
      `${placement}:${cleanToken}`;

    const controller =
      new AbortController();

    const loadPromotion = async () => {
      try {
        const response = await fetch(
          API_BASE_URL +
            "/api/promotions/student/active?placement=" +
            encodeURIComponent(placement),
          {
            headers: {
              Authorization:
                `Bearer ${cleanToken}`,
            },
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          setLoadedPromotion({
            requestKey,
            promotion: null,
          });
          return;
        }

        const result =
          (await response.json()) as
            StudentPromotionResponse;

        if (
          !result.success ||
          !result.data
        ) {
          setLoadedPromotion({
            requestKey,
            promotion: null,
          });
          return;
        }

        setLoadedPromotion({
          requestKey,
          promotion: result.data,
        });
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setLoadedPromotion({
          requestKey,
          promotion: null,
        });
      }
    };

    void loadPromotion();

    return () => {
      controller.abort();
    };
  }, [placement, token]);

  const cleanToken = token.trim();

  const currentRequestKey =
    `${placement}:${cleanToken}`;

  const promotion =
    loadedPromotion.requestKey ===
    currentRequestKey
      ? loadedPromotion.promotion
      : null;
  if (!promotion) {
    return null;
  }

  const isPrimary =
    placement ===
    "student_dashboard_primary";

  return (
    <article
      className={
        isPrimary
          ? "group relative overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-r from-[#241046] via-[#34185f] to-[#17305f] text-white shadow-sm"
          : "group relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-r from-[#fffaf5] via-[#fff8fd] to-[#f5f7ff] text-slate-950 shadow-sm"
      }
    >
      <div
        className={
          promotion.imageUrl?.trim()
            ? "grid grid-cols-[minmax(0,1fr)_92px] sm:grid-cols-[minmax(0,1fr)_180px]"
            : ""
        }
      >
        <div className="min-w-0 p-4 sm:px-5 sm:py-4">
          <div className="flex flex-wrap items-center gap-2">
            {promotion.badgeText?.trim() ? (
              <span
                className={
                  isPrimary
                    ? "inline-flex rounded-full border border-fuchsia-300/25 bg-fuchsia-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-fuchsia-100"
                    : "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-700"
                }
              >
                {promotion.badgeText}
              </span>
            ) : null}

            <span
              className={
                isPrimary
                  ? "text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200"
                  : "text-[9px] font-black uppercase tracking-[0.18em] text-violet-500"
              }
            >
              Pravixo Offer
            </span>
          </div>

          <h2 className="mt-2 line-clamp-2 text-base font-black leading-snug tracking-tight sm:text-lg">
            {promotion.title}
          </h2>

          {promotion.subtitle?.trim() ? (
            <p
              className={
                isPrimary
                  ? "mt-1.5 line-clamp-2 max-w-3xl text-xs leading-5 text-violet-100/90 sm:text-sm"
                  : "mt-1.5 line-clamp-2 max-w-3xl text-xs leading-5 text-slate-600 sm:text-sm"
              }
            >
              {promotion.subtitle}
            </p>
          ) : null}

          <Link
            href={promotion.ctaUrl}
            className={
              isPrimary
                ? "mt-3 inline-flex min-h-9 items-center rounded-xl bg-[#fff8ff] px-3.5 text-xs font-black text-[#26134d] transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-fuchsia-300/30"
                : "mt-3 inline-flex min-h-9 items-center rounded-xl bg-violet-700 px-3.5 text-xs font-black text-white transition hover:bg-violet-800 focus:outline-none focus:ring-4 focus:ring-violet-300/30"
            }
          >
            {promotion.ctaLabel}
            <span
              aria-hidden="true"
              className="ml-2 transition group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </div>

        {promotion.imageUrl?.trim() ? (
          <div
            className={
              isPrimary
                ? "min-h-full overflow-hidden border-l border-white/10 bg-[#1b1330]"
                : "min-h-full overflow-hidden border-l border-violet-100 bg-white/70"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={promotion.imageUrl}
              alt={promotion.title}
              className="h-full min-h-[122px] w-full object-cover sm:min-h-[132px]"
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

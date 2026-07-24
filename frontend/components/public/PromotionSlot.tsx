"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

export type PromotionPlacement =
  | "home_hero"
  | "exams_hero"
  | "study_notes_hero"
  | "current_affairs_hero"
  | "jobs_hero"
  | "mock_tests_hero";

type PublicPromotion = {
  _id: string;
  placement: PromotionPlacement;
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

type PromotionResponse = {
  success: boolean;
  data?: PublicPromotion | null;
  message?: string;
};

type PromotionSlotProps = {
  placement: PromotionPlacement;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/+$/, "");

export default function PromotionSlot({
  placement,
}: PromotionSlotProps) {
  const [promotion, setPromotion] =
    useState<PublicPromotion | null>(null);

  useEffect(() => {
    if (!API_BASE_URL) {
      setPromotion(null);
      return;
    }

    const controller =
      new AbortController();

    const loadPromotion = async () => {
      try {
        const response = await fetch(
          API_BASE_URL +
            "/api/promotions/active?placement=" +
            encodeURIComponent(placement),
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          setPromotion(null);
          return;
        }

        const result =
          (await response.json()) as
            PromotionResponse;

        if (
          !result.success ||
          !result.data
        ) {
          setPromotion(null);
          return;
        }

        setPromotion(result.data);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setPromotion(null);
      }
    };

    void loadPromotion();

    return () => {
      controller.abort();
    };
  }, [placement]);

  if (!promotion) {
    return null;
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/10 p-5 text-white shadow-xl shadow-slate-950/20 backdrop-blur sm:p-6">
      {promotion.imageUrl?.trim() ? (
        <div className="mb-5 overflow-hidden rounded-2xl bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={promotion.imageUrl}
            alt={promotion.title}
            className="aspect-[16/7] w-full object-cover"
          />
        </div>
      ) : null}

      {promotion.badgeText?.trim() ? (
        <span className="inline-flex rounded-full border border-blue-300/20 bg-blue-400/15 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-100">
          {promotion.badgeText}
        </span>
      ) : null}

      <h2 className="mt-3 text-xl font-black leading-snug tracking-tight sm:text-2xl">
        {promotion.title}
      </h2>

      {promotion.subtitle?.trim() ? (
        <p className="mt-3 text-sm leading-6 text-slate-200">
          {promotion.subtitle}
        </p>
      ) : null}

      <Link
        href={promotion.ctaUrl}
        className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-sm font-black text-slate-950 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300/30"
      >
        {promotion.ctaLabel}
      </Link>
    </article>
  );
}
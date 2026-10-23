import type { Metadata } from "next";
import type { PublicContentItem, PublicContentType } from "./publicContent";

export const PUBLIC_SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://pravixoedutech.in"
).replace(/\/+$/, "");

const BRAND = "PravixoEduTech";

const routeBases: Record<PublicContentType, string> = {
  article: "/articles",
  study_note: "/study-notes",
  notification: "/notifications",
  current_affairs: "/current-affairs",
  vacancy: "/vacancies",
  admit_card: "/admit-cards",
  result: "/results",
  syllabus: "/syllabus",
  exam_page: "/exams",
};

// Existing translated articles use the same slug with a "-hindi" suffix.
export const getPublicContentLanguage = (item: Pick<PublicContentItem, "slug">) =>
  item.slug.endsWith("-hindi") ? "hi-IN" as const : "en-IN" as const;

export const getTranslationSlug = (slug: string) =>
  slug.endsWith("-hindi") ? slug.slice(0, -6) : `${slug}-hindi`;

export const getPublicContentUrl = (item: Pick<PublicContentItem, "slug" | "type">) =>
  `${PUBLIC_SITE_URL}${routeBases[item.type]}/${encodeURIComponent(item.slug)}`;

export const getPublicContentTitle = (item: PublicContentItem) => {
  const title = (item.seoTitle?.trim() || item.title.trim())
    .replace(/(?:\s*[|–—-]\s*PravixoEduTech)+\s*$/gi, "")
    .trim();

  return !title || title.toLowerCase() === BRAND.toLowerCase()
    ? BRAND
    : `${title} | ${BRAND}`;
};

export const getPublicContentDescription = (item: PublicContentItem) =>
  item.seoDescription?.trim() ||
  item.summary?.trim() ||
  (getPublicContentLanguage(item) === "hi-IN"
    ? `${item.title} की जानकारी ${BRAND} पर पढ़ें।`
    : `Read ${item.title} on ${BRAND}.`);

export const toIsoDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const getAbsoluteFeaturedImageUrl = (value?: string) => {
  if (!value?.trim()) return undefined;

  try {
    const image = value.trim();
    if (image.startsWith("//")) return undefined;
    if (!image.startsWith("/") && !image.startsWith("https://")) return undefined;
    const url = new URL(image, PUBLIC_SITE_URL);
    if (url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
};

export const isPublishedTranslationPair = (
  item: PublicContentItem,
  candidate?: PublicContentItem | null
): candidate is PublicContentItem => Boolean(
  candidate &&
  candidate.type === item.type &&
  candidate.slug === getTranslationSlug(item.slug) &&
  candidate.status === "published" &&
  getPublicContentLanguage(candidate) !== getPublicContentLanguage(item)
);

export const buildPublicContentMetadata = (
  item: PublicContentItem,
  translation?: PublicContentItem | null
): Metadata => {
  const title = getPublicContentTitle(item);
  const description = getPublicContentDescription(item);
  const url = getPublicContentUrl(item);
  const language = getPublicContentLanguage(item);
  const image = getAbsoluteFeaturedImageUrl(item.featuredImage);
  const paired = isPublishedTranslationPair(item, translation);

  return {
    // Avoid applying the root title template to an already branded title.
    title: { absolute: title },
    description,
    keywords: item.tags,
    alternates: {
      canonical: url,
      languages: paired ? {
        [language]: url,
        [getPublicContentLanguage(translation)]: getPublicContentUrl(translation),
      } : undefined,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: BRAND,
      type: "article",
      locale: language.replace("-", "_"),
      alternateLocale: paired
        ? [getPublicContentLanguage(translation).replace("-", "_")]
        : undefined,
      publishedTime: toIsoDate(item.publishedAt) || toIsoDate(item.createdAt),
      modifiedTime: toIsoDate(item.updatedAt) || toIsoDate(item.publishedAt) || toIsoDate(item.createdAt),
      images: image ? [{ url: image, alt: item.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
};

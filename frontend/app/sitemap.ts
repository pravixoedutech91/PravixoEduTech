import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type PublicContentType =
  | "article"
  | "study_note"
  | "notification"
  | "current_affairs"
  | "vacancy"
  | "admit_card"
  | "result"
  | "syllabus"
  | "exam_page";

type PublicContentItem = {
  _id?: string;
  slug?: string;
  type?: PublicContentType;
  updatedAt?: string;
  publishedAt?: string;
  createdAt?: string;
};

type PublicContentListResponse = {
  success?: boolean;
  data?: PublicContentItem[];
};

const livePublicRoutes = [
  "",
  "/exams",
  "/articles",
  "/study-notes",
  "/current-affairs",
  "/notifications",
  "/vacancies",
  "/admit-cards",
  "/results",
  "/syllabus",
  "/mock-tests",
  "/about",
  "/contact",
  "/editorial-policy",
  "/correction-policy",
];

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

const getValidDate = (value?: string) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const getPublishedPublicContent = async () => {
  try {
    const url = new URL("/api/content/public", apiBaseUrl);
    url.searchParams.set("limit", "500");

    const response = await fetch(url.toString(), {
      next: {
        revalidate: 3600,
      },
    });

    if (!response.ok) {
      return [];
    }

    const body = (await response.json()) as PublicContentListResponse;

    return Array.isArray(body.data) ? body.data : [];
  } catch {
    return [];
  }
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const contentItems = await getPublishedPublicContent();

  const staticRoutes = livePublicRoutes.map((route) => ({
    url: siteUrl + route,
    lastModified: now,
    changeFrequency: route === "" ? "daily" as const : "weekly" as const,
    priority: route === "" ? 1 : 0.8,
  }));

  const detailRoutes = contentItems
    .filter((item) => Boolean(item.slug && item.type && routeBases[item.type]))
    .map((item) => {
      const routeBase = routeBases[item.type as PublicContentType];
      const lastModified =
        getValidDate(item.updatedAt) ||
        getValidDate(item.publishedAt) ||
        getValidDate(item.createdAt) ||
        now;

      return {
        url: `${siteUrl}${routeBase}/${item.slug}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    });

  return [...staticRoutes, ...detailRoutes];
}

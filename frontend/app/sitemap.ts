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
  page?: number;
  totalPages?: number;
  hasMore?: boolean;
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

const SITEMAP_PAGE_SIZE = 100;
const SITEMAP_MAX_PAGES = 1000;

const getPublishedPublicContent = async () => {
  const contentItems: PublicContentItem[] = [];
  let page = 1;

  try {
    while (page <= SITEMAP_MAX_PAGES) {
      const url = new URL(
        "/api/content/public",
        apiBaseUrl
      );

      url.searchParams.set("page", String(page));
      url.searchParams.set(
        "limit",
        String(SITEMAP_PAGE_SIZE)
      );

      const response = await fetch(url.toString(), {
        next: {
          revalidate: 3600,
        },
      });

      if (!response.ok) {
        return contentItems;
      }

      const body =
        (await response.json()) as PublicContentListResponse;

      const pageItems = Array.isArray(body.data)
        ? body.data
        : [];

      contentItems.push(...pageItems);

      const totalPages =
        Number.isInteger(body.totalPages) &&
        Number(body.totalPages) >= 0
          ? Number(body.totalPages)
          : page;

      const hasMore =
        body.hasMore === true || page < totalPages;

      if (!hasMore || pageItems.length === 0) {
        break;
      }

      page += 1;
    }

    return contentItems;
  } catch {
    return contentItems;
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

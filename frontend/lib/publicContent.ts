export type PublicContentType =
  | "article"
  | "study_note"
  | "notification"
  | "current_affairs"
  | "vacancy"
  | "admit_card"
  | "result"
  | "syllabus"
  | "exam_page";

export type PublicCategory = {
  _id?: string;
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
};

export type PublicContentItem = {
  _id: string;
  title: string;
  slug: string;
  type: PublicContentType;
  category?: PublicCategory | null;
  summary?: string;
  content?: string;
  featuredImage?: string;
  tags?: string[];
  status?: "draft" | "published";
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicContentListResponse = {
  success: boolean;
  count: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  data: PublicContentItem[];
};

export type PublicContentSingleResponse = {
  success: boolean;
  data: PublicContentItem;
};

export type PublicContentPageResult = {
  items: PublicContentItem[];
  error: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const normalizePositiveInteger = (
  value: number,
  fallback: number
) =>
  Number.isInteger(value) && value > 0
    ? value
    : fallback;

const getEmptyPageResult = (
  error: string,
  page: number,
  limit: number
): PublicContentPageResult => ({
  items: [],
  error,
  total: 0,
  page,
  limit,
  totalPages: 0,
  hasMore: false,
});

const getPublicContentPage = async (
  url: URL,
  page: number,
  limit: number,
  fallbackError: string
): Promise<PublicContentPageResult> => {
  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!response.ok) {
      return getEmptyPageResult(
        `Content API returned ${response.status}`,
        page,
        limit
      );
    }

    const body =
      (await response.json()) as PublicContentListResponse;

    return {
      items: Array.isArray(body.data) ? body.data : [],
      error: "",
      total: Number.isFinite(body.total) ? body.total : 0,
      page: Number.isInteger(body.page) ? body.page : page,
      limit: Number.isInteger(body.limit) ? body.limit : limit,
      totalPages: Number.isInteger(body.totalPages)
        ? body.totalPages
        : 0,
      hasMore: body.hasMore === true,
    };
  } catch {
    return getEmptyPageResult(
      fallbackError,
      page,
      limit
    );
  }
};

export const getPublicContentList = async (
  type: PublicContentType,
  limit = 24,
  page = 1
): Promise<PublicContentPageResult> => {
  const safePage = normalizePositiveInteger(page, 1);
  const safeLimit = normalizePositiveInteger(limit, 24);

  const url = new URL("/api/content/public", API_BASE);
  url.searchParams.set("type", type);
  url.searchParams.set("page", String(safePage));
  url.searchParams.set("limit", String(safeLimit));

  return getPublicContentPage(
    url,
    safePage,
    safeLimit,
    "Unable to load public content right now."
  );
};

export const getPublicContentSearchList = async (
  query: string,
  page = 1,
  limit = 30
): Promise<PublicContentPageResult> => {
  const safeQuery = query.trim();
  const safePage = normalizePositiveInteger(page, 1);
  const safeLimit = normalizePositiveInteger(limit, 30);

  if (!safeQuery) {
    return getEmptyPageResult(
      "",
      safePage,
      safeLimit
    );
  }

  const url = new URL("/api/content/public", API_BASE);
  url.searchParams.set("q", safeQuery);
  url.searchParams.set("page", String(safePage));
  url.searchParams.set("limit", String(safeLimit));

  return getPublicContentPage(
    url,
    safePage,
    safeLimit,
    "Unable to load search results right now."
  );
};

export const getPublicContentBySlug = async (
  slug: string
): Promise<{
  item: PublicContentItem | null;
  error: string;
}> => {
  try {
    const response = await fetch(
      `${API_BASE}/api/content/public/${encodeURIComponent(slug)}`,
      {
        cache: "no-store",
      }
    );

    if (response.status === 404) {
      return {
        item: null,
        error: "",
      };
    }

    if (!response.ok) {
      return {
        item: null,
        error: `Content API returned ${response.status}`,
      };
    }

    const body =
      (await response.json()) as PublicContentSingleResponse;

    return {
      item: body.data || null,
      error: "",
    };
  } catch {
    return {
      item: null,
      error:
        "Unable to load this public content right now.",
    };
  }
};
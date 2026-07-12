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
  data: PublicContentItem[];
};

export type PublicContentSingleResponse = {
  success: boolean;
  data: PublicContentItem;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

export const getPublicContentList = async (
  type: PublicContentType,
  limit = 24
): Promise<{
  items: PublicContentItem[];
  error: string;
}> => {
  try {
    const url = new URL("/api/content/public", API_BASE);
    url.searchParams.set("type", type);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        items: [],
        error: `Content API returned ${response.status}`,
      };
    }

    const body = (await response.json()) as PublicContentListResponse;

    return {
      items: Array.isArray(body.data) ? body.data : [],
      error: "",
    };
  } catch {
    return {
      items: [],
      error: "Unable to load public content right now.",
    };
  }
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

    const body = (await response.json()) as PublicContentSingleResponse;

    return {
      item: body.data || null,
      error: "",
    };
  } catch {
    return {
      item: null,
      error: "Unable to load this public content right now.",
    };
  }
};

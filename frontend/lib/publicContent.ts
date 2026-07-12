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

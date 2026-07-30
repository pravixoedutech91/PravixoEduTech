import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import PublicContentBody from "@/components/public/PublicContentBody";
import {
  getPublicContentBySlug,
  type PublicContentItem,
  type PublicContentType,
} from "@/lib/publicContent";

type PublicContentDetailPageProps = {
  slug: string;
  expectedType: PublicContentType;
  backHref: string;
  backLabel: string;
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const typeLabels: Record<PublicContentType, string> = {
  article: "Article",
  study_note: "Study Note",
  notification: "Notification",
  current_affairs: "Current Affairs",
  vacancy: "Vacancy",
  admit_card: "Admit Card",
  result: "Result",
  syllabus: "Syllabus",
  exam_page: "Exam Page",
};

const articleLikeTypes: PublicContentType[] = [
  "article",
  "study_note",
  "current_affairs",
  "syllabus",
  "exam_page",
];

const formatDate = (value?: string) => {
  if (!value) {
    return "Recently updated";
  }

  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Recently updated";
  }
};

const toIsoDate = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

const getParagraphs = (content?: string) => {
  if (!content) {
    return [];
  }

  const normalizedContent = content
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");

  return normalizedContent
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
};

const getPlainText = (content?: string) => {
  return getParagraphs(content).join(" ");
};

const getContentTypeLabel = (type: PublicContentType) => {
  return typeLabels[type] || "Public Content";
};

const getJsonLdType = (type: PublicContentType) => {
  if (type === "current_affairs" || type === "notification") {
    return "NewsArticle";
  }

  if (articleLikeTypes.includes(type)) {
    return "Article";
  }

  return "WebPage";
};

const buildJsonLd = ({
  item,
  backHref,
}: {
  item: PublicContentItem;
  backHref: string;
}) => {
  const pageUrl = `${SITE_URL}${backHref}/${item.slug}`;
  const publishedDate = toIsoDate(item.publishedAt || item.createdAt);
  const modifiedDate = toIsoDate(item.updatedAt || item.publishedAt || item.createdAt);
  const description =
    item.seoDescription ||
    item.summary ||
    `Read ${item.title} on PravixoEduTech.`;
  const plainText = getPlainText(item.content);

  const articleSchema = {
    "@type": getJsonLdType(item.type),
    "@id": `${pageUrl}#article`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
    headline: item.seoTitle || item.title,
    name: item.title,
    description,
    datePublished: publishedDate,
    dateModified: modifiedDate,
    articleSection: item.category?.name || getContentTypeLabel(item.type),
    keywords: item.tags || [],
    author: {
      "@type": "Organization",
      name: "PravixoEduTech",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "PravixoEduTech",
      url: SITE_URL,
    },
    inLanguage: "en-IN",
    isAccessibleForFree: true,
    text: plainText || undefined,
  };

  const breadcrumbSchema = {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: item.category?.name || getContentTypeLabel(item.type),
        item: `${SITE_URL}${backHref}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: item.title,
        item: pageUrl,
      },
    ],
  };

  const webPageSchema = {
    "@type": "WebPage",
    "@id": pageUrl,
    url: pageUrl,
    name: item.seoTitle || item.title,
    description,
    isPartOf: {
      "@type": "WebSite",
      name: "PravixoEduTech",
      url: SITE_URL,
    },
    breadcrumb: {
      "@id": `${pageUrl}#breadcrumb`,
    },
    primaryImageOfPage: item.featuredImage || undefined,
    datePublished: publishedDate,
    dateModified: modifiedDate,
    inLanguage: "en-IN",
  };

  return {
    "@context": "https://schema.org",
    "@graph": [webPageSchema, breadcrumbSchema, articleSchema],
  };
};

export default async function PublicContentDetailPage({
  slug,
  expectedType,
  backHref,
  backLabel,
}: PublicContentDetailPageProps) {
  const { item, error } = await getPublicContentBySlug(slug);

  if (!item || item.type !== expectedType) {
    notFound();
  }

  const hasContent = Boolean(item.content?.trim());
  const typeLabel = getContentTypeLabel(item.type);
  const updatedDate = formatDate(item.updatedAt || item.publishedAt || item.createdAt);
  const jsonLd = buildJsonLd({ item, backHref });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <Navbar />

      <main>
        <article className="bg-white">
          <header className="border-b border-slate-200">
            <div className="mx-auto max-w-4xl px-4 py-12">
              <nav aria-label="Breadcrumb">
                <Link
                  href={backHref}
                  className="text-sm font-black text-blue-700 hover:text-blue-900"
                >
                  &lt; Back to {backLabel}
                </Link>
              </nav>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                  {typeLabel}
                </span>

                {item.category?.name ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {item.category.name}
                  </span>
                ) : null}

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  Updated {updatedDate}
                </span>
              </div>

              <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                {item.title}
              </h1>

              {item.summary || item.seoDescription ? (
                <section
                  aria-label="Quick answer"
                  className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-6"
                >
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">
                    Quick Answer
                  </p>

                  <p className="mt-3 text-lg leading-8 text-slate-800">
                    {item.summary || item.seoDescription}
                  </p>
                </section>
              ) : null}

              <div className="mt-6 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Content Type
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-950">
                    {typeLabel}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Category
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-950">
                    {item.category?.name || backLabel}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Last Updated
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-950">
                    {updatedDate}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {(item.tags || []).slice(0, 6).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </header>

          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              {error ? (
                <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
                  {error}
                </div>
              ) : null}

              {hasContent ? (
                <section aria-label="Main content">
                  <PublicContentBody content={item.content ?? ""} />
                </section>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <h2 className="text-2xl font-black text-slate-950">
                    Content body will appear here
                  </h2>

                  <p className="mt-3 text-slate-600">
                    The published page exists, but the main content body is currently empty.
                  </p>
                </div>
              )}
            </div>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-lg font-black text-slate-950">
                  About this page
                </h2>

                <dl className="mt-5 space-y-4 text-sm">
                  <div>
                    <dt className="font-black text-slate-500">
                      Published by
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      PravixoEduTech Editorial Team
                    </dd>
                  </div>

                  <div>
                    <dt className="font-black text-slate-500">
                      Review status
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      Public informational content
                    </dd>
                  </div>

                  <div>
                    <dt className="font-black text-slate-500">
                      Updated
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {updatedDate}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
                <h2 className="text-lg font-black text-slate-950">
                  Trust note
                </h2>

                <p className="mt-3 text-sm leading-7 text-slate-700">
                  This page is created for exam preparation guidance and public awareness.
                  For official dates, eligibility and final notices, always verify the official exam authority website.
                </p>
              </section>
            </aside>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}

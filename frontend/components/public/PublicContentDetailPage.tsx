import Link from "next/link";
import { notFound } from "next/navigation";
import localFont from "next/font/local";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import PublicContentBody from "@/components/public/PublicContentBody";
import PublicShareButton from "@/components/public/PublicShareButton";
import {
  getPublicContentBySlug,
  type PublicContentItem,
  type PublicContentType,
} from "@/lib/publicContent";
import {
  PUBLIC_SITE_URL,
  getAbsoluteFeaturedImageUrl,
  getPublicContentDescription,
  getPublicContentLanguage,
  getPublicContentTitle,
  getPublicContentUrl,
  toIsoDate,
} from "@/lib/publicContentSeo";
import { formatPublicContentDate, getPublicContentCopy } from "@/lib/publicContentPresentation";

const devanagari = localFont({
  src: "../../fonts/NotoSansDevanagari.woff2",
  display: "swap",
  preload: false,
  weight: "100 900",
});

type PublicContentDetailPageProps = {
  slug: string;
  expectedType: PublicContentType;
  backHref: string;
  backLabel: string;
};

const SITE_URL = PUBLIC_SITE_URL;

const articleLikeTypes: PublicContentType[] = [
  "article",
  "study_note",
  "current_affairs",
  "syllabus",
  "exam_page",
];

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

const getSafeFeaturedImageUrl = (value?: string) => {
  if (!value) {
    return "";
  }

  const trimmedUrl = value.trim();

  if (
    trimmedUrl.startsWith("/") &&
    !trimmedUrl.startsWith("//")
  ) {
    return trimmedUrl;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    if (parsedUrl.protocol === "https:") {
      return trimmedUrl;
    }
  } catch {
    return "";
  }

  return "";
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
  backLabel,
}: {
  item: PublicContentItem;
  backHref: string;
  backLabel: string;
}) => {
  const pageUrl = getPublicContentUrl(item);
  const publishedDate = toIsoDate(item.publishedAt) || toIsoDate(item.createdAt);
  const modifiedDate = toIsoDate(item.updatedAt) || toIsoDate(item.publishedAt) || toIsoDate(item.createdAt);
  const description = getPublicContentDescription(item);
  const language = getPublicContentLanguage(item);
  const plainText = getPlainText(item.content);

  const articleSchema = {
    "@type": getJsonLdType(item.type),
    "@id": `${pageUrl}#article`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
    headline: item.title,
    name: item.title,
    description,
    datePublished: publishedDate,
    dateModified: modifiedDate,
    articleSection: item.category?.name || getPublicContentCopy(language).types[item.type],
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
    inLanguage: language,
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
        name: backLabel,
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
    name: getPublicContentTitle(item),
    description,
    isPartOf: {
      "@type": "WebSite",
      name: "PravixoEduTech",
      url: SITE_URL,
    },
    breadcrumb: {
      "@id": `${pageUrl}#breadcrumb`,
    },
    primaryImageOfPage: getAbsoluteFeaturedImageUrl(item.featuredImage),
    datePublished: publishedDate,
    dateModified: modifiedDate,
    inLanguage: language,
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
  const language = getPublicContentLanguage(item);
  const isHindi = language === "hi-IN";
  const copy = getPublicContentCopy(language);
  const typeLabel = copy.types[item.type];
  const listLabel = copy.lists[item.type];
  const isStudyMaterial = item.type === "study_note" || item.type === "article";
  const updatedDate = formatPublicContentDate(item.updatedAt || item.publishedAt || item.createdAt, language);
  const featuredImageUrl =
    item.type === "exam_page"
      ? getSafeFeaturedImageUrl(item.featuredImage)
      : "";
  const jsonLd = buildJsonLd({ item, backHref, backLabel });

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
        <article lang={language} className={`bg-white ${isHindi ? devanagari.className : ""}`}>
          <header className="border-b border-slate-200">
            <div className="mx-auto max-w-4xl px-4 py-12">
              <div className="flex items-center justify-between gap-3">
                <nav aria-label="Breadcrumb">
                  <Link
                    href={backHref}
                    className="text-sm font-black text-blue-700 hover:text-blue-900"
                  >
                    &lt; {copy.back} {listLabel}
                  </Link>
                </nav>

                <PublicShareButton
                  title={item.title}
                  language={language}
                  text={
                    item.summary ||
                    item.seoDescription ||
                    (isHindi ? `${item.title} की जानकारी PravixoEduTech पर पढ़ें।` : `Read ${item.title} on PravixoEduTech.`)
                  }
                />
              </div>

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
                  {copy.updated} {updatedDate}
                </span>
              </div>

              <h1 className={`mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl ${isHindi ? "leading-[1.4] sm:leading-[1.35]" : ""}`}>
                {item.title}
              </h1>

              {item.summary || item.seoDescription ? (
                <section
                  aria-label={copy.quickAnswer}
                  className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-6"
                >
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">
                    {copy.quickAnswer}
                  </p>

                  <p className="mt-3 text-lg leading-9 text-slate-800">
                    {item.summary || item.seoDescription}
                  </p>
                </section>
              ) : null}

              <div className="mt-6 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    {copy.contentType}
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-950">
                    {typeLabel}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    {copy.category}
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-950">
                    {item.category?.name || backLabel}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    {copy.lastUpdated}
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

              {featuredImageUrl ? (
                <figure className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm">
                  <img
                    src={featuredImageUrl}
                    alt={isHindi ? `${item.title} की तैयारी से संबंधित चित्र` : `${item.title} featured preparation image`}
                    width={1672}
                    height={941}
                    loading="eager"
                    decoding="async"
                    className="block aspect-video w-full object-cover"
                  />
                </figure>
              ) : null}
              {hasContent ? (
                <section aria-label={copy.mainContent}>
                  <PublicContentBody content={item.content ?? ""} language={language} />
                </section>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <h2 className="text-2xl font-black text-slate-950">
                    {copy.emptyTitle}
                  </h2>

                  <p className="mt-3 text-slate-600">
                    {copy.emptyBody}
                  </p>
                </div>
              )}
            </div>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-lg font-black text-slate-950">
                  {copy.about}
                </h2>

                <dl className="mt-5 space-y-4 text-sm">
                  <div>
                    <dt className="font-black text-slate-500">
                      {copy.publishedBy}
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {copy.editorialTeam}
                    </dd>
                  </div>

                  <div>
                    <dt className="font-black text-slate-500">
                      {copy.reviewStatus}
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {copy.informational}
                    </dd>
                  </div>

                  <div>
                    <dt className="font-black text-slate-500">
                      {copy.updated}
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {updatedDate}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
                <h2 className="text-lg font-black text-slate-950">
                  {isStudyMaterial ? copy.studyTitle : copy.trustTitle}
                </h2>

                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {isStudyMaterial ? (
                    <>{copy.studyBody}{" "}<Link href="/correction-policy" className="font-bold text-blue-700 underline underline-offset-4">{copy.correctionPolicy}</Link>{isHindi ? "।" : "."}</>
                  ) : copy.trustBody}
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

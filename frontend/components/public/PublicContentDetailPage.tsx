import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import {
  getPublicContentBySlug,
  type PublicContentType,
} from "@/lib/publicContent";

type PublicContentDetailPageProps = {
  slug: string;
  expectedType: PublicContentType;
  backHref: string;
  backLabel: string;
};

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

  const paragraphs = getParagraphs(item.content);

  return (
    <>
      <Navbar />

      <main>
        <article className="bg-white">
          <header className="border-b border-slate-200">
            <div className="mx-auto max-w-4xl px-4 py-12">
              <Link
                href={backHref}
                className="text-sm font-black text-blue-700 hover:text-blue-900"
              >
                &lt; Back to {backLabel}
              </Link>

              <div className="mt-6 flex flex-wrap gap-2">
                {item.category?.name ? (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                    {item.category.name}
                  </span>
                ) : null}

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {formatDate(item.publishedAt || item.createdAt)}
                </span>
              </div>

              <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                {item.title}
              </h1>

              {item.summary || item.seoDescription ? (
                <p className="mt-6 text-lg leading-8 text-slate-600">
                  {item.summary || item.seoDescription}
                </p>
              ) : null}

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

          <div className="mx-auto max-w-4xl px-4 py-12">
            {error ? (
              <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
                {error}
              </div>
            ) : null}

            {paragraphs.length > 0 ? (
              <div className="space-y-6 text-base leading-8 text-slate-700">
                {paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
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
        </article>
      </main>

      <Footer />
    </>
  );
}

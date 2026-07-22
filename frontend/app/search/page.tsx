import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PublicSearchBar from "@/components/common/PublicSearchBar";
import {
  getPublicContentSearchList,
  type PublicContentItem,
  type PublicContentType,
} from "@/lib/publicContent";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search PravixoEduTech public exam preparation content including notes, current affairs, notifications, vacancies and syllabus.",
  robots: {
    index: false,
    follow: false,
  },
};

type SearchPageProps = {
  searchParams?: Promise<{
    q?: string;
    page?: string;
  }>;
};

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

const parsePage = (value?: string) => {
  const page = Number(value);

  return Number.isInteger(page) && page > 0
    ? page
    : 1;
};

const getSearchPageHref = (
  query: string,
  page: number
) => {
  const params = new URLSearchParams({
    q: query,
  });

  if (page > 1) {
    params.set("page", String(page));
  }

  return `/search?${params.toString()}`;
};

const formatDate = (value?: string) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default async function SearchPage({
  searchParams,
}: SearchPageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() || "";
  const hasQuery = Boolean(query);
  const requestedPage = parsePage(params?.page);

  const searchData = hasQuery
    ? await getPublicContentSearchList(
        query,
        requestedPage,
        30
      )
    : {
        items: [],
        error: "",
        total: 0,
        page: 1,
        limit: 30,
        totalPages: 0,
        hasMore: false,
      };

  return (
    <>
      <Navbar />

      <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-12">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">
          Search
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
          Search PravixoEduTech
        </h1>

        <p className="mt-4 max-w-2xl text-slate-600">
          Find public exam preparation content across notes, current affairs,
          notifications, vacancies, admit cards, results, syllabus and exam pages.
        </p>

        <div className="mt-8">
          <PublicSearchBar
            compact
            defaultValue={query}
            placeholder="Search exam content..."
          />
        </div>

        {!hasQuery ? (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-black text-slate-950">
              Start searching
            </h2>
            <p className="mt-2 text-slate-600">
              Type a keyword like polity, notification, syllabus, vacancy,
              current affairs or an exam name.
            </p>
          </section>
        ) : null}

        {hasQuery ? (
          <section className="mt-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
                Results
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                {searchData.total} result{searchData.total === 1 ? "" : "s"} for "{query}"
              </h2>

              {searchData.error ? (
                <p className="mt-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                  {searchData.error}
                </p>
              ) : null}

              {!searchData.error && searchData.items.length === 0 ? (
                <div className="mt-5 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                  <h3 className="font-black text-slate-950">
                    No matching public content found
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Try a shorter keyword, another exam name or a category like
                    article, study note, current affairs, notification, vacancy,
                    result or syllabus.
                  </p>
                </div>
              ) : null}

              {searchData.items.length > 0 ? (
                <div className="mt-6 grid gap-4">
                  {searchData.items.map((item) => {
                    const routeBase = routeBases[item.type] || "/articles";
                    const href = `${routeBase}/${item.slug}`;
                    const publishedDate = formatDate(
                      item.publishedAt || item.updatedAt || item.createdAt
                    );

                    return (
                      <article
                        key={item._id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-blue-200 hover:bg-blue-50/50"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">
                            {typeLabels[item.type] || "Content"}
                          </span>

                          {item.category?.name ? (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                              {item.category.name}
                            </span>
                          ) : null}

                          {publishedDate ? (
                            <span className="text-xs font-semibold text-slate-500">
                              {publishedDate}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-3 text-xl font-black text-slate-950">
                          <Link href={href} className="hover:text-blue-700">
                            {item.title}
                          </Link>
                        </h3>

                        {item.summary || item.seoDescription ? (
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                            {item.summary || item.seoDescription}
                          </p>
                        ) : null}

                        {item.tags && item.tags.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.tags.slice(0, 6).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <Link
                          href={href}
                          className="mt-5 inline-flex text-sm font-black text-blue-700 hover:text-blue-900"
                        >
                          Open result &rarr;
                        </Link>
                      </article>
                    );
                  })}
                </div>
              ) : null}

              {searchData.totalPages > 1 ? (
                <nav
                  className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"
                  aria-label="Search result pages"
                >
                  {searchData.page > 1 ? (
                    <Link
                      href={getSearchPageHref(
                        query,
                        searchData.page - 1
                      )}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-blue-300 hover:text-blue-700"
                    >
                      &larr; Previous
                    </Link>
                  ) : (
                    <span className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-black text-slate-400">
                      &larr; Previous
                    </span>
                  )}

                  <span className="text-sm font-bold text-slate-600">
                    Page {searchData.page} of{" "}
                    {searchData.totalPages}
                  </span>

                  {searchData.hasMore ? (
                    <Link
                      href={getSearchPageHref(
                        query,
                        searchData.page + 1
                      )}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-blue-300 hover:text-blue-700"
                    >
                      Next &rarr;
                    </Link>
                  ) : (
                    <span className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-black text-slate-400">
                      Next &rarr;
                    </span>
                  )}
                </nav>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>

      <Footer />
    </>
  );
}

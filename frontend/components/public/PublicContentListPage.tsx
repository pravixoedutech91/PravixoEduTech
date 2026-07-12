import PublicSearchBar from "@/components/common/PublicSearchBar";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import {
  getPublicContentList,
  type PublicContentType,
} from "@/lib/publicContent";

type PublicContentListPageProps = {
  type: PublicContentType;
  title: string;
  eyebrow: string;
  description: string;
  routeBase: string;
  emptyTitle: string;
  emptyDescription: string;
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

export default async function PublicContentListPage({
  type,
  title,
  eyebrow,
  description,
  routeBase,
  emptyTitle,
  emptyDescription,
}: PublicContentListPageProps) {
  const { items, error } = await getPublicContentList(type);

  return (
    <>
      <Navbar />

      <main>
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">
              {eyebrow}
            </p>

            <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_420px] lg:items-end">
              <div>
                <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                  {title}
                </h1>

                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
                  {description}
                </p>
              </div>

              <PublicSearchBar compact />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12">
          {error ? (
            <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
              {error}
            </div>
          ) : null}

          {items.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <article
                  key={item._id}
                  className="flex min-h-64 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
                >
                  <div className="flex flex-wrap gap-2">
                    {item.category?.name ? (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                        {item.category.name}
                      </span>
                    ) : null}

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {formatDate(item.publishedAt || item.createdAt)}
                    </span>
                  </div>

                  <h2 className="mt-5 text-xl font-black leading-snug text-slate-950">
                    {item.title}
                  </h2>

                  <p className="mt-3 line-clamp-4 text-sm leading-7 text-slate-600">
                    {item.summary ||
                      item.seoDescription ||
                      "Read this public exam preparation update on PravixoEduTech."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {(item.tags || []).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-6">
                    <span className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">
                      Detail page coming next
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">
                Coming Soon
              </p>

              <h2 className="mt-3 text-3xl font-black text-slate-950">
                {emptyTitle}
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-slate-600">
                {emptyDescription}
              </p>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}

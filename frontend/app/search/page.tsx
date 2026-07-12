import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PublicSearchBar from "@/components/common/PublicSearchBar";

type SearchPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function SearchPage({
  searchParams,
}: SearchPageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() || "";

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
          Search foundation is ready. In the next step, this page will connect to public notes,
          current affairs, notifications, vacancies, syllabus and exam pages.
        </p>

        <div className="mt-8">
          <PublicSearchBar
            compact
            placeholder="Search exam content..."
          />
        </div>

        {query ? (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-black text-slate-950">
              Search query received
            </h2>
            <p className="mt-2 text-slate-600">
              You searched for: <span className="font-bold text-slate-950">{query}</span>
            </p>
          </div>
        ) : null}
      </main>

      <Footer />
    </>
  );
}

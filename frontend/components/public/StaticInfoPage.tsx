import Link from "next/link";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

type StaticInfoSection = {
  title: string;
  paragraphs: string[];
};

type StaticInfoPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: StaticInfoSection[];
  finalNote?: string;
};

export default function StaticInfoPage({
  eyebrow,
  title,
  description,
  sections,
  finalNote,
}: StaticInfoPageProps) {
  return (
    <>
      <Navbar />

      <main>
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-14">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">
              {eyebrow}
            </p>

            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {title}
            </h1>

            <p className="mt-5 text-lg leading-8 text-slate-600">
              {description}
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <h2 className="text-2xl font-black text-slate-950">
                  {section.title}
                </h2>

                <div className="mt-4 space-y-4 text-base leading-8 text-slate-700">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}

            {finalNote ? (
              <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6 text-sm leading-7 text-slate-700">
                {finalNote}
              </div>
            ) : null}
          </div>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-lg font-black text-slate-950">
                Trust Center
              </h2>

              <ul className="mt-5 space-y-3 text-sm font-bold">
                <li>
                  <Link href="/about" className="text-blue-700 hover:text-blue-900">
                    About PravixoEduTech
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-blue-700 hover:text-blue-900">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/editorial-policy" className="text-blue-700 hover:text-blue-900">
                    Editorial Policy
                  </Link>
                </li>
                <li>
                  <Link href="/correction-policy" className="text-blue-700 hover:text-blue-900">
                    Correction Policy
                  </Link>
                </li>
              </ul>
            </section>

            <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
              <h2 className="text-lg font-black text-slate-950">
                Important note
              </h2>

              <p className="mt-3 text-sm leading-7 text-slate-700">
                PravixoEduTech publishes exam preparation information for learning and awareness.
                Aspirants should always verify final dates, eligibility and notices from official exam authorities.
              </p>
            </section>
          </aside>
        </section>
      </main>

      <Footer />
    </>
  );
}

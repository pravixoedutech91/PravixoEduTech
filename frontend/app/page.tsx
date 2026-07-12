import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PublicSearchBar from "@/components/common/PublicSearchBar";

const examCards = [
  "MPPSC",
  "SSC",
  "Banking",
  "Railway",
  "Vyapam / MPESB",
  "UPSC",
];

const updateCards = [
  {
    title: "Exam Notifications",
    description: "Track important application dates, eligibility and official updates.",
    href: "/notifications",
  },
  {
    title: "Vacancies & Jobs",
    description: "Find government job alerts arranged for quick reading and action.",
    href: "/vacancies",
  },
  {
    title: "Admit Cards & Results",
    description: "Follow admit card releases, result updates and next-step guidance.",
    href: "/admit-cards",
  },
];

const learningCards = [
  {
    title: "Study Notes",
    description: "Topic-wise notes designed for revision and concept clarity.",
    href: "/study-notes",
  },
  {
    title: "Current Affairs",
    description: "Daily, weekly and monthly current affairs for competitive exams.",
    href: "/current-affairs",
  },
  {
    title: "Mock Tests",
    description: "Practice with protected mock tests built for real exam discipline.",
    href: "/student/mock-tests",
  },
];

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute left-[-10%] top-[-20%] h-72 w-72 rounded-full bg-blue-600/30 blur-3xl" />
          <div className="absolute bottom-[-20%] right-[-10%] h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-blue-300/30 bg-white/10 px-4 py-2 text-sm font-bold text-blue-100 backdrop-blur">
                Public content + mock test practice for serious aspirants
              </p>

              <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Prepare smarter for government exams with notes, updates and mock tests.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                PravixoEduTech helps aspirants find exam updates, syllabus, current affairs,
                study notes and practice tests in one focused platform.
              </p>

              <div className="mt-8 max-w-2xl">
                <PublicSearchBar />
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/study-notes"
                  className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-blue-50"
                >
                  Explore Free Notes
                </Link>
                <Link
                  href="/student/login"
                  className="rounded-full border border-white/30 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  Login for Mock Tests
                </Link>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
              <h2 className="text-xl font-black">
                Popular Exam Categories
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {examCards.map((exam) => (
                  <Link
                    key={exam}
                    href="/exams"
                    className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm font-bold text-white transition hover:bg-white/20"
                  >
                    {exam}
                  </Link>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-white p-5 text-slate-950">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">
                  Platform Rule
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Public articles are open. Mock tests, attempts and protected downloads require login.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">
                Latest updates
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Find what needs your attention first
              </h2>
            </div>

            <Link
              href="/notifications"
              className="text-sm font-black text-blue-700 hover:text-blue-900"
            >
              View all updates ?
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {updateCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
              >
                <h3 className="text-xl font-black text-slate-950">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {card.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">
                Learning path
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Read, revise and practice
              </h2>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {learningCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-200 transition hover:bg-blue-50 hover:ring-blue-200"
                >
                  <h3 className="text-xl font-black text-slate-950">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {card.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

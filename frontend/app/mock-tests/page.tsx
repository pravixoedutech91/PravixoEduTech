import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Mock Tests",
  description:
    "Practice government exam mock tests on PravixoEduTech. Login is required to start protected test attempts.",
};

export default function MockTestsPublicPage() {
  return (
    <>
      <Navbar />

      <main>
        <section className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:py-16 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:gap-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300 sm:text-sm">
                Protected Practice
              </p>

              <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-5xl">
                Practice mock tests with login-based attempt tracking.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:leading-8">
                Mock tests are protected so your attempts, timing, results and review data remain connected to your student account.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/student/login"
                  className="inline-flex min-h-12 items-center rounded-xl bg-white px-6 text-sm font-bold text-slate-950 shadow-lg shadow-slate-950/20 transition hover:bg-blue-50"
                >
                  Login to Start Mock Tests
                </Link>

                <Link
                  href="/study-notes"
                  className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-6 text-sm font-bold text-white transition hover:border-white/50 hover:bg-white/10"
                >
                  Read Free Notes First
                </Link>
              </div>
            </div>

            <aside className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl shadow-slate-950/20 sm:p-6">
              <h2 className="text-xl font-bold tracking-tight">Why login is required?</h2>

              <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-200">
                <li>- Save and resume attempts securely.</li>
                <li>- Show result and review after submission.</li>
                <li>- Protect correct answers before submission.</li>
                <li>- Keep student attempt history private.</li>
              </ul>
            </aside>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

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
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1fr_420px] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-300">
                Protected Practice
              </p>

              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
                Practice mock tests with login-based attempt tracking.
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
                Mock tests are protected so your attempts, timing, results and review data remain connected to your student account.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/student/login"
                  className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-blue-50"
                >
                  Login to Start Mock Tests
                </Link>

                <Link
                  href="/study-notes"
                  className="rounded-full border border-white/30 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  Read Free Notes First
                </Link>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-white/10 bg-white/10 p-6">
              <h2 className="text-xl font-black">Why login is required?</h2>

              <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-200">
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

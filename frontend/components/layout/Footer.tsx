import Link from "next/link";

const footerGroups = [
  {
    title: "Prepare",
    links: [
      { href: "/exams", label: "Exam Hub" },
      { href: "/study-notes", label: "Study Notes" },
      { href: "/current-affairs", label: "Current Affairs" },
      { href: "/mock-tests", label: "Mock Tests" },
    ],
  },
  {
    title: "Updates",
    links: [
      { href: "/notifications", label: "Notifications" },
      { href: "/vacancies", label: "Vacancies" },
      { href: "/admit-cards", label: "Admit Cards" },
      { href: "/results", label: "Results" },
      { href: "/syllabus", label: "Syllabus" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/editorial-policy", label: "Editorial Policy" },
      { href: "/correction-policy", label: "Correction Policy" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[1.4fr_2fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black">
              P
            </span>

            <span>
              <span className="block text-2xl font-black">
                PravixoEduTech
              </span>
              <span className="block text-sm font-medium text-slate-400">
                Learn. Practice. Succeed.
              </span>
            </span>
          </Link>

          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300">
            A public-first exam preparation platform for government exam aspirants.
            Read free content, follow exam updates, and practice through protected mock tests.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href="/student/login"
              className="rounded-full bg-white px-5 py-2 font-bold text-slate-950 transition hover:bg-blue-50"
            >
              Student Login
            </Link>
            <Link
              href="/admin/login"
              className="rounded-full border border-slate-700 px-5 py-2 font-bold text-slate-200 transition hover:border-slate-400"
            >
              Admin Login
            </Link>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                {group.title}
              </h2>

              <ul className="mt-4 space-y-3">
                {group.links.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm font-medium text-slate-300 transition hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>� 2026 PravixoEduTech. All rights reserved.</p>
          <p>Public content is informational. Always verify official exam notices.</p>
        </div>
      </div>
    </footer>
  );
}

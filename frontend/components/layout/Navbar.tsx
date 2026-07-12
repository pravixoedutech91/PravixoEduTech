import Link from "next/link";
import PublicSearchBar from "@/components/common/PublicSearchBar";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/exams", label: "Exams" },
  { href: "/current-affairs", label: "Current Affairs" },
  { href: "/study-notes", label: "Notes" },
  { href: "/vacancies", label: "Jobs" },
  { href: "/mock-tests", label: "Mock Tests" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="bg-blue-950 px-4 py-2 text-center text-xs font-medium text-blue-50 sm:text-sm">
        Public content is free to read. Login is required for mock tests and protected downloads.
      </div>

      <nav
        className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 xl:flex-row xl:items-center xl:justify-between"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-lg font-black text-white shadow-lg shadow-blue-700/25">
              P
            </span>

            <span>
              <span className="block text-xl font-black tracking-tight text-slate-950 group-hover:text-blue-700">
                PravixoEduTech
              </span>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Learn. Practice. Succeed.
              </span>
            </span>
          </Link>

          <Link
            href="/student/login"
            className="rounded-full border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700 transition hover:border-blue-700 hover:bg-blue-50 xl:hidden"
          >
            Login
          </Link>
        </div>

        <div className="hidden w-full max-w-sm xl:block">
          <PublicSearchBar compact />
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end">
          {primaryLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
            >
              {item.label}
            </Link>
          ))}

          <Link
            href="/student/login"
            className="hidden shrink-0 rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 xl:inline-flex"
          >
            Student Login
          </Link>
        </div>
      </nav>
    </header>
  );
}

import Link from "next/link";
import MobileQuickNav from "./MobileQuickNav";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/exams", label: "Exams" },
  { href: "/vacancies", label: "Vacancies" },
  { href: "/syllabus", label: "Syllabus" },
  { href: "/current-affairs", label: "Current Affairs" },
  { href: "/study-notes", label: "Study Notes" },
  { href: "/mock-tests", label: "Mock Tests" },
];


function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
      <div className="bg-blue-950 px-4 py-2 text-center text-xs font-semibold text-blue-50 sm:text-sm">
        Free notes, exam updates and practice resources for Indian aspirants.
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:py-4">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-3"
          aria-label="PravixoEduTech home"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-lg font-black text-white shadow-md shadow-blue-700/20">
            P
          </span>

          <span className="min-w-0">
            <span className="block truncate text-xl font-black tracking-tight text-slate-950 transition group-hover:text-blue-700">
              PravixoEduTech
            </span>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">
              Learn. Practice. Succeed.
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <Link
            href="/search"
            aria-label="Search PravixoEduTech"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            <SearchIcon />
          </Link>

          <details className="group relative">
            <summary
              className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-full bg-blue-700 px-3 font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100 motion-safe:animate-pulse [&::-webkit-details-marker]:hidden"
              style={{
                animationDuration: "1.1s",
                animationIterationCount: 3,
              }}
            >
              <MenuIcon />
              <span className="sr-only sm:not-sr-only">Menu</span>
            </summary>

            <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-950/20 sm:w-80">
              <Link
                href="/student/login"
                className="flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-bold text-white transition hover:bg-blue-800"
              >
                Student Login
              </Link>

              <nav
                aria-label="Mobile navigation"
                className="mt-3 grid gap-1"
              >
                {primaryLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </details>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 px-5 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            <SearchIcon />
            Search
          </Link>

          <Link
            href="/student/login"
            className="inline-flex min-h-11 items-center rounded-full bg-blue-700 px-6 text-sm font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800"
          >
            Student Login
          </Link>
        </div>
      </div>

      <MobileQuickNav />
      <div className="hidden border-t border-slate-100 bg-white lg:block">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-2"
        >
          {primaryLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
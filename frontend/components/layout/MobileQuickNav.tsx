"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const priorityLinks = [
  { href: "/vacancies", label: "Vacancies" },
  { href: "/syllabus", label: "Syllabus" },
  { href: "/mock-tests", label: "Mock Tests" },
];

function isCurrentSection(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileQuickNav() {
  const pathname = usePathname() ?? "";

  const currentPriorityLink = priorityLinks.find((item) =>
    isCurrentSection(pathname, item.href),
  );

  const visibleLinks = currentPriorityLink
    ? [
        { href: "/", label: "Home" },
        ...priorityLinks.filter(
          (item) => item.href !== currentPriorityLink.href,
        ),
      ]
    : priorityLinks;

  return (
    <nav
      aria-label="Mobile quick navigation"
      className="grid grid-cols-3 gap-1 border-t border-slate-100 bg-white px-2 py-1.5 lg:hidden"
    >
      {visibleLinks.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg px-1 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
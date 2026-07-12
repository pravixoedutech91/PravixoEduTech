import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/exams",
          "/syllabus",
          "/notifications",
          "/current-affairs",
          "/articles",
          "/study-notes",
          "/vacancies",
          "/admit-cards",
          "/results",
          "/mock-tests",
          "/about",
          "/contact",
          "/editorial-policy",
          "/correction-policy",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/student",
          "/student/",
          "/search",
          "/api",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const livePublicRoutes = [
  "",
  "/exams",
  "/articles",
  "/study-notes",
  "/current-affairs",
  "/notifications",
  "/vacancies",
  "/admit-cards",
  "/results",
  "/syllabus",
  "/mock-tests",
  "/about",
  "/contact",
  "/editorial-policy",
  "/correction-policy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return livePublicRoutes.map((route) => ({
    url: siteUrl + route,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}

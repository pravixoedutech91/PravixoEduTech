import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Only include routes that currently exist and are safe to index.
 * More public routes will be added here after their pages are implemented.
 */
const livePublicRoutes = [""];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return livePublicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 1,
  }));
}

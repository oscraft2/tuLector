import type { MetadataRoute } from "next";

const siteUrl = "https://tulector.vercel.app";

const routes = ["/", "/scan", "/sheet", "/support", "/security", "/privacy", "/terms", "/data-request"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}

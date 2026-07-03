import type { MetadataRoute } from "next";

const siteUrl = "https://tulector.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/scan", "/sheet", "/support", "/security", "/privacy", "/terms", "/data-request"],
        disallow: ["/admin", "/dashboard", "/settings", "/logs", "/results", "/api"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

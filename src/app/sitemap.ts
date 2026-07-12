import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { articleContent } from "@/lib/recursos_content";

const siteUrl = "https://tulector.app";

const publicRoutes = [
  "/",
  "/support",
  "/security",
  "/privacy",
  "/terms",
  "/data-request",
  "/para-colegios",
  "/para-docentes",
  "/para-preuniversitarios",
  "/precios",
  "/features",
  "/recursos",
];

const articleSlugs = Object.keys(articleContent);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routeEntries = locales.flatMap((locale) =>
    publicRoutes.map((route) => {
      const path = route === "/" ? "" : route;
      return {
        url: `${siteUrl}/${locale}${path}`,
        lastModified: now,
        changeFrequency: route === "/" ? ("weekly" as const) : ("monthly" as const),
        priority: route === "/" ? 1 : route.startsWith("/para-") ? 0.9 : 0.7,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${siteUrl}/${l}${path}`])
          ),
        },
      };
    })
  );

  const articleEntries = locales.flatMap((locale) =>
    articleSlugs.map((slug) => {
      const articlePath = `/recursos/${slug}`;
      return {
        url: `${siteUrl}/${locale}${articlePath}`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: 0.7,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${siteUrl}/${l}${articlePath}`])
          ),
        },
      };
    })
  );

  return [...routeEntries, ...articleEntries];
}

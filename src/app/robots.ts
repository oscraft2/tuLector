import type { MetadataRoute } from "next";

const siteUrl = "https://tulector.app";

export default function robots(): MetadataRoute.Robots {
  const publicLocales = ["/", "/es-MX/", "/es-PE/", "/es-AR/", "/pt-BR/", "/es-CL/"];
  const privatePaths = [
    "/admin", "/dashboard", "/settings", "/logs", "/results", "/api",
    "/r/", "/auth", "/pruebas", "/test", "/consulta", "/account-deleted",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: publicLocales,
        disallow: privatePaths,
      },
      {
        userAgent: ["GPTBot", "ClaudeBot", "Google-Extended", "PerplexityBot", "Applebot-Extended"],
        allow: publicLocales,
        disallow: privatePaths,
      },
      {
        userAgent: "CCBot",
        disallow: ["/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

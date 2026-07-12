import type { MetadataRoute } from "next";

const siteUrl = "https://tulector.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/es-MX", "/es-PE", "/es-AR", "/pt-BR", "/es-CL"],
        disallow: [
          "/admin", "/dashboard", "/settings", "/logs", "/results", "/api",
          "/r/", "/auth", "/pruebas", "/test", "/consulta", "/account-deleted",
        ],
      },
      { userAgent: "GPTBot", allow: ["/", "/es-MX/", "/es-PE/", "/es-AR/", "/pt-BR/", "/es-CL/"], disallow: ["/api/"] },
      { userAgent: "ClaudeBot", allow: ["/", "/es-MX/", "/es-PE/", "/es-AR/", "/pt-BR/", "/es-CL/"], disallow: ["/api/"] },
      { userAgent: "Google-Extended", allow: ["/", "/es-MX/recursos/", "/es-PE/recursos/", "/es-AR/recursos/", "/pt-BR/recursos/", "/es-CL/recursos/"], disallow: ["/api/"] },
      { userAgent: "PerplexityBot", allow: ["/", "/es-MX/recursos/"], disallow: ["/api/"] },
      { userAgent: "CCBot", disallow: ["/"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

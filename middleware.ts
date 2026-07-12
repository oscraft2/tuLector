import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const adminPrefix = "/admin";
const allowedAdminRoles = new Set(["platform_admin", "support", "finance", "marketing"]);

const localePrefixes = ["es-MX", "es-PE", "es-AR", "pt-BR", "es-CL"];

function detectFromAccept(accept: string): string | null {
  const langs = accept.split(",").map((l) => l.split(";")[0].trim().toLowerCase());
  for (const lang of langs) {
    if (localePrefixes.includes(lang)) return lang;
    if (lang.startsWith("es-mx")) return "es-MX";
    if (lang.startsWith("es-pe")) return "es-PE";
    if (lang.startsWith("es-ar")) return "es-AR";
    if (lang.startsWith("pt-br") || lang.startsWith("pt")) return "pt-BR";
    if (lang.startsWith("es-cl")) return "es-CL";
    if (lang.startsWith("es")) return "es-MX";
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams, origin } = request.nextUrl;

  // i18n redirect: visitas a "/" sin locale → redirect a /<locale> segun Accept-Language
  if (pathname === "/" && !searchParams.has("code")) {
    const cookieLocale = request.cookies.get("tulector-locale")?.value;
    if (cookieLocale && localePrefixes.includes(cookieLocale)) {
      const url = new URL(`/${cookieLocale}`, request.url);
      url.search = searchParams.toString();
      const response = NextResponse.redirect(url);
      response.cookies.set("tulector-locale", cookieLocale, { maxAge: 60 * 60 * 24 * 365, path: "/" });
      return response;
    }
    const accept = request.headers.get("accept-language") ?? "";
    const detected = detectFromAccept(accept);
    if (detected) {
      const url = new URL(`/${detected}`, request.url);
      url.search = searchParams.toString();
      const response = NextResponse.redirect(url);
      response.cookies.set("tulector-locale", detected, { maxAge: 60 * 60 * 24 * 365, path: "/" });
      return response;
    }
  }

  // Supabase puede volver al Site URL raiz si el redirectTo no esta allowlisted.
  // Si vuelve a /?code=..., lo normalizamos al callback real para crear cookies SSR.
  if (pathname === "/" && searchParams.has("code")) {
    const callbackUrl = new URL("/auth/callback", origin);
    callbackUrl.searchParams.set("code", searchParams.get("code") ?? "");
    callbackUrl.searchParams.set("next", searchParams.get("next") ?? "/dashboard");
    return NextResponse.redirect(callbackUrl);
  }

  // For dashboard routes, set pathname header so the layout can detect onboarding
  if (pathname.startsWith("/dashboard")) {
    const response = NextResponse.next({
      request: { headers: new Headers(request.headers) },
    });
    response.headers.set("x-pathname", pathname);
    return response;
  }

  if (!pathname.startsWith(adminPrefix)) return NextResponse.next();

  const response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;

  if (!user || !role || !allowedAdminRoles.has(role)) {
    const url = new URL("/dashboard", request.url);
    url.searchParams.set("admin", "denied");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/", "/admin/:path*", "/dashboard/:path*"],
};

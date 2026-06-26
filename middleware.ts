import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const adminPrefix = "/admin";
const allowedAdminRoles = new Set(["platform_admin", "support", "finance", "marketing"]);

export async function middleware(request: NextRequest) {
  const { pathname, searchParams, origin } = request.nextUrl;

  // Supabase puede volver al Site URL raiz si el redirectTo no esta allowlisted.
  // Si vuelve a /?code=..., lo normalizamos al callback real para crear cookies SSR.
  if (pathname === "/" && searchParams.has("code")) {
    const callbackUrl = new URL("/auth/callback", origin);
    callbackUrl.searchParams.set("code", searchParams.get("code") ?? "");
    callbackUrl.searchParams.set("next", searchParams.get("next") ?? "/dashboard");
    return NextResponse.redirect(callbackUrl);
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
  matcher: ["/", "/admin/:path*"],
};

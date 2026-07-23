import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase_server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");
  // Si el request viene del APK (WebView, trae el token TuLectorApp en el
  // User-Agent), el destino por defecto es el menu nativo, no el dashboard
  // web -- mismo criterio que dashboard/layout.tsx.
  const isNative = /TuLectorApp/i.test(request.headers.get("user-agent") ?? "");
  const next = safeNextPath(requestUrl.searchParams.get("next"), isNative ? "/app" : "/dashboard");

  if (oauthError) {
    return redirectToAuth(requestUrl.origin, oauthError);
  }

  if (!code) {
    return redirectToAuth(requestUrl.origin, "No se recibio codigo de autenticacion.");
  }

  // El link de confirmacion de un registro con email en el APK apunta aca
  // con ?from=app (ver auth/page.tsx signUp). Si el App Link no logro abrir
  // la app (todavia no propago la verificacion, o el usuario abrio el correo
  // en otro dispositivo), este request llega SIN el token nativo -- estamos
  // en Chrome. El intercambio PKCE fallaria de todos modos aca (el
  // code_verifier vive en el cookie-jar del WebView, no en Chrome), asi que
  // en vez de intentarlo y quemar el code, mandamos a la pagina puente que
  // ofrece abrir la app directamente.
  if (requestUrl.searchParams.get("from") === "app" && !isNative) {
    const bridge = new URL("/auth/app-bridge", requestUrl.origin);
    bridge.searchParams.set("code", code);
    return NextResponse.redirect(bridge);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToAuth(requestUrl.origin, error.message);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

function redirectToAuth(origin: string, message: string) {
  const authUrl = new URL("/auth", origin);
  authUrl.searchParams.set("error", message);
  return NextResponse.redirect(authUrl);
}

function safeNextPath(next: string | null, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

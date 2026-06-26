import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase_server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (oauthError) {
    return redirectToAuth(requestUrl.origin, oauthError);
  }

  if (!code) {
    return redirectToAuth(requestUrl.origin, "No se recibio codigo de autenticacion.");
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

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

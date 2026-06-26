import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase_server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (oauthError) {
    const authUrl = new URL("/auth", requestUrl.origin);
    authUrl.searchParams.set("error", oauthError);
    return NextResponse.redirect(authUrl);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/auth", requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const authUrl = new URL("/auth", requestUrl.origin);
    authUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

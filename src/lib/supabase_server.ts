import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { DashboardLocale } from "@/locales";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type SchoolRole = "admin" | "teacher" | "viewer";

export type DashboardSchool = {
  id: string;
  name: string;
  subdomain: string | null;
  plan: "starter" | "pro" | "school" | "district";
  country_code: string | null;
  region: string | null;
  city: string | null;
  grading_scale_min: number | null;
  grading_scale_max: number | null;
  passing_grade: number | null;
  exigencia: number | null;
  ministry_format: string | null;
  scans_limit: number | null;
  scans_used: number | null;
  created_at: string;
  branding_logo_url?: string | null;
  branding_primary_color?: string | null;
  timezone?: string | null;
  date_format?: string | null;
  scan_prefs?: Record<string, unknown> | null;
};

export type DashboardMember = {
  id: string;
  school_id: string;
  user_id: string;
  role: SchoolRole;
  created_at: string;
};

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; Route Handlers and Actions can.
        }
      },
    },
  });
}

export async function getDashboardContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: membership, error: membershipError } = await supabase
    .from("school_members")
    .select("id, school_id, user_id, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw new Error(membershipError.message);
  if (!membership) redirect("/dashboard/onboarding");

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("*")
    .eq("id", membership.school_id)
    .single();

  if (schoolError) throw new Error(schoolError.message);

  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    member: membership as DashboardMember,
    school: school as DashboardSchool,
    locale: ((profile?.locale as DashboardLocale | undefined) ?? "es-CL"),
    isAdmin: membership.role === "admin",
  };
}

export function assertSchoolAdmin(isAdmin: boolean) {
  if (!isAdmin) throw new Error("Solo un administrador del colegio puede realizar esta accion.");
}

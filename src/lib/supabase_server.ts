import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { DashboardLocale } from "@/locales";
import { resolveCountryProfile } from "@/lib/country_profiles";

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
  rbd?: string | null;
  institucion_tipo?: string | null;
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

  const cookieStore = await cookies();
  const activeSchoolId = cookieStore.get("tulector_active_school_id")?.value;

  let membership: any = null;

  // Staff check y membresia-activa son independientes → en paralelo. La
  // membresia-activa solo se pide si hay cookie de colegio activo.
  const [{ data: staffMember }, activeMembershipResult] = await Promise.all([
    supabase.from("platform_users").select("role").eq("user_id", user.id).is("revoked_at", null).maybeSingle(),
    activeSchoolId
      ? supabase.from("school_members").select("id, school_id, user_id, role, created_at").eq("user_id", user.id).eq("school_id", activeSchoolId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const isStaff = staffMember !== null;

  // Try to use school ID from cookie if it's valid for this user
  if (activeSchoolId) {
    membership = activeMembershipResult.data;

    // Staff impersonation override: if user is staff and has school ID cookie, grant session
    if (!membership && isStaff) {
      membership = {
        id: "impersonated-session",
        school_id: activeSchoolId,
        user_id: user.id,
        role: "admin",
        created_at: new Date().toISOString(),
      };
    }
  }

  // Fallback to the first school membership
  if (!membership) {
    const { data, error: membershipError } = await supabase
      .from("school_members")
      .select("id, school_id, user_id, role, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError) throw new Error(membershipError.message);
    membership = data;

    // Set cookie for active school
    if (membership) {
      try {
        cookieStore.set("tulector_active_school_id", membership.school_id, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        });
      } catch {
        // Cookies can only be set in Server Actions / Route Handlers, not Server Components
      }
    }
  }

  if (!membership) redirect("/dashboard/onboarding");

  // Fetch school details
  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("*")
    .eq("id", membership.school_id)
    .maybeSingle();

  if (schoolError || !school) {
    console.warn("[getDashboardContext] School not found for membership:", membership?.school_id, schoolError?.message);
    redirect("/dashboard/onboarding");
  }

  // Estas dos son independientes entre si → en paralelo (ahorra un round-trip
  // Vercel↔Supabase, que a Chile pesa). allMemberships alimenta el switcher;
  // profile trae el idioma.
  const [{ data: allMemberships }, { data: profile }] = await Promise.all([
    supabase.from("school_members").select("id, school_id, role, schools(name)").eq("user_id", user.id),
    supabase.from("profiles").select("locale").eq("user_id", user.id).maybeSingle(),
  ]);

  const userSchools = (allMemberships ?? []).map((m: any) => ({
    id: m.school_id,
    name: m.schools?.name || "Colegio sin nombre",
    role: m.role,
  }));

  return {
    supabase,
    user,
    member: membership as DashboardMember,
    school: school as DashboardSchool,
    countryProfile: resolveCountryProfile((school as DashboardSchool).country_code),
    locale: ((profile?.locale as DashboardLocale | undefined) ?? "es-CL"),
    isAdmin: membership.role === "admin",
    userSchools,
  };
}

export function assertSchoolAdmin(isAdmin: boolean) {
  if (!isAdmin) throw new Error("Solo un administrador del colegio puede realizar esta accion.");
}

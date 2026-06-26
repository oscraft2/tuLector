"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase_server";

export async function completeOnboarding(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nombre de institucion requerido.");
  const country = String(formData.get("country_code") ?? "CL");
  const defaults = country === "BR"
    ? { grading_scale_min: 0, grading_scale_max: 10, passing_grade: 6, exigencia: 0.6, ministry_format: "br_generic" }
    : { grading_scale_min: 1, grading_scale_max: 7, passing_grade: 4, exigencia: 0.6, ministry_format: "cl_mineduc" };

  const { data: school, error } = await supabase.from("schools").insert({
    name,
    subdomain: String(formData.get("subdomain") ?? "") || null,
    country_code: country,
    region: String(formData.get("region") ?? "") || null,
    city: String(formData.get("city") ?? "") || null,
    plan: "starter",
    scans_limit: 100,
    scans_used: 0,
    ...defaults,
  }).select("id").single();
  if (error) throw new Error(error.message);

  await supabase.from("school_members").insert({ school_id: school.id, user_id: user.id, role: "admin" });
  await supabase.from("profiles").upsert({ user_id: user.id, locale: country === "BR" ? "pt-BR" : "es-CL" });
  redirect("/dashboard/settings");
}

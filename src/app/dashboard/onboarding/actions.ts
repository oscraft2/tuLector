"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase_server";
import { countryDefaults, resolveCountryProfile } from "@/lib/country_profiles";
import { sendTemplatedEmail } from "@/lib/email";

export async function completeOnboarding(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nombre de institucion requerido.");
  const country = resolveCountryProfile(String(formData.get("country_code") ?? "CL"));
  const defaults = countryDefaults(country.code);
  const rbd = String(formData.get("rbd") ?? "").trim() || null;
  const institucionTipo = String(formData.get("institucion_tipo") ?? "").trim() || null;

  const { data: school, error } = await supabase.from("schools").insert({
    name,
    rbd,
    institucion_tipo: institucionTipo,
    subdomain: String(formData.get("subdomain") ?? "") || null,
    country_code: country.code,
    region: String(formData.get("region") ?? "") || null,
    city: String(formData.get("city") ?? "") || null,
    plan: "starter",
    scans_limit: 100,
    scans_used: 0,
    ...defaults,
  }).select("id").single();

  if (error) {
    console.error("completeOnboarding ERROR inserting school:", error);
    throw new Error(error.message);
  }

  const { error: memberError } = await supabase.from("school_members").insert({ school_id: school.id, user_id: user.id, role: "admin" });
  if (memberError) {
    console.error("completeOnboarding ERROR inserting school member:", memberError);
    throw new Error(memberError.message);
  }

  const { error: profileError } = await supabase.from("profiles").upsert({ user_id: user.id, locale: country.locale });
  if (profileError) {
    console.error("completeOnboarding ERROR upserting profile:", profileError);
    throw new Error(profileError.message);
  }

  // Bienvenida best-effort: si el correo falla, no bloquea la creacion del
  // colegio (mismo criterio que el resto de disparadores de sendTemplatedEmail).
  if (user.email) {
    try {
      await sendTemplatedEmail({
        to: user.email,
        templateKey: "account_welcome",
        locale: country.locale,
        variables: {
          school_name: name,
          user_email: user.email,
          plan_name: "starter",
          scans_limit: 100,
        },
      });
    } catch (emailError) {
      console.warn("completeOnboarding: fallo el correo de bienvenida:", emailError);
    }
  }

  redirect("/dashboard");
}

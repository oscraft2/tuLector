"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformContext, writeAuditLog } from "@/lib/supabaseAdmin";

export async function upsertFaqCategory(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "support"]);
  const id = formData.get("id") ? String(formData.get("id")) : undefined;
  const locale = String(formData.get("locale") ?? "es-CL").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const sort_order = parseInt(String(formData.get("sort_order") ?? "0"), 10);
  const published = formData.get("published") === "on";

  if (!name || !slug) throw new Error("Nombre y slug son obligatorios.");

  const payload = { locale, name, slug, sort_order, published, updated_at: new Date().toISOString() };

  if (id) {
    const { error } = await admin.from("faq_categories").update(payload).eq("id", id);
    if (error) throw new Error(`Error al actualizar categoría: ${error.message}`);
  } else {
    const { error } = await admin.from("faq_categories").insert(payload);
    if (error) throw new Error(`Error al crear categoría: ${error.message}`);
  }

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: role,
    targetType: "faq_category",
    targetId: id || "new",
    action: "faq.category_upsert",
    reason: "Guardado desde panel admin",
    metadata: { locale, slug, published },
  });

  revalidatePath("/admin/help-center");
}

export async function upsertFaqArticle(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "support"]);
  const id = formData.get("id") ? String(formData.get("id")) : undefined;
  const category_id = String(formData.get("category_id") ?? "");
  const locale = String(formData.get("locale") ?? "es-CL").trim();
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const body_md = String(formData.get("body_md") ?? "").trim();
  const published = formData.get("published") === "on";
  const tagsStr = String(formData.get("tags") ?? "").trim();
  const tags = tagsStr ? tagsStr.split(",").map(t => t.trim()).filter(Boolean) : [];

  if (!title || !slug || !body_md || !category_id) {
    throw new Error("Faltan campos obligatorios para el artículo.");
  }

  const payload = { category_id, locale, title, slug, body_md, tags, published, updated_at: new Date().toISOString() };

  if (id) {
    const { error } = await admin.from("faq_articles").update(payload).eq("id", id);
    if (error) throw new Error(`Error al actualizar artículo: ${error.message}`);
  } else {
    const { error } = await admin.from("faq_articles").insert(payload);
    if (error) throw new Error(`Error al crear artículo: ${error.message}`);
  }

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: role,
    targetType: "faq_article",
    targetId: id || "new",
    action: "faq.article_upsert",
    reason: "Guardado desde panel admin",
    metadata: { locale, slug, published, category_id },
  });

  revalidatePath("/admin/help-center");
}

export async function toggleFaqPublished(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "support"]);
  const id = String(formData.get("id") ?? "");
  const table = String(formData.get("table") ?? "faq_articles");
  const published = formData.get("published") === "true";

  if (!id || (table !== "faq_articles" && table !== "faq_categories")) return;

  const { error } = await admin.from(table).update({ published, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`Error al publicar/despublicar: ${error.message}`);

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: role,
    targetType: table,
    targetId: id,
    action: `faq.${table}_toggle_publish`,
    reason: `Publicado: ${published}`,
  });

  revalidatePath("/admin/help-center");
}

export async function deleteFaqArticle(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "support"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await admin.from("faq_articles").delete().eq("id", id);
  if (error) throw new Error(`Error al eliminar artículo: ${error.message}`);

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: role,
    targetType: "faq_article",
    targetId: id,
    action: "faq.article_delete",
    reason: "Eliminado desde panel admin",
  });

  revalidatePath("/admin/help-center");
}

"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformContext, writeAuditLog } from "@/lib/supabaseAdmin";

const LOCALES = new Set(["es-CL", "es-MX", "es-PE", "es-AR", "pt-BR"]);
const STATUSES = new Set(["draft", "review", "published", "archived"]);

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function upsertFaqCategory(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "support"]);
  const id = formData.get("id") ? String(formData.get("id")) : undefined;
  const locale = String(formData.get("locale") ?? "es-CL").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const sort_order = parseInt(String(formData.get("sort_order") ?? "0"), 10);
  const published = formData.get("published") === "on";

  if (!name || !slug || !LOCALES.has(locale)) throw new Error("Nombre, slug e idioma válido son obligatorios.");

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
  const statusValue = String(formData.get("status") ?? "draft");
  const status = STATUSES.has(statusValue) ? statusValue : "draft";
  const published = status === "published";
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const seo_title = String(formData.get("seo_title") ?? "").trim() || null;
  const seo_description = String(formData.get("seo_description") ?? "").trim() || null;
  const featured = formData.get("featured") === "on";
  const reading_minutes = Math.max(1, Math.min(60, parseInt(String(formData.get("reading_minutes") ?? "3"), 10) || 3));
  const tagsStr = String(formData.get("tags") ?? "").trim();
  const tags = tagsStr ? tagsStr.split(",").map(t => slugify(t.trim())).filter(Boolean) : [];

  if (!title || !slug || !body_md || !category_id || !LOCALES.has(locale)) {
    throw new Error("Faltan campos obligatorios para el artículo.");
  }

  const { data: category } = await admin.from("faq_categories").select("locale").eq("id", category_id).single();
  if (!category || category.locale !== locale) throw new Error("La categoría debe pertenecer al mismo idioma que el artículo.");

  const payload = {
    category_id, locale, title, slug, body_md, tags, excerpt, seo_title, seo_description,
    featured, reading_minutes, status, published, published_at: published ? new Date().toISOString() : null,
    author_id: user.id, updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data: previous } = await admin.from("faq_articles").select("title, excerpt, body_md, category_id, locale, tags, status").eq("id", id).single();
    if (previous) {
      await admin.from("faq_article_revisions").insert({
        article_id: id, title: previous.title, excerpt: previous.excerpt ?? "", body_md: previous.body_md,
        metadata: { category_id: previous.category_id, locale: previous.locale, tags: previous.tags, status: previous.status },
        created_by: user.id,
      });
    }
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
    metadata: { locale, slug, status, published, category_id },
  });

  revalidatePath("/admin/help-center");
}

export async function toggleFaqPublished(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "support"]);
  const id = String(formData.get("id") ?? "");
  const table = String(formData.get("table") ?? "faq_articles");
  const published = formData.get("published") === "true";

  if (!id || (table !== "faq_articles" && table !== "faq_categories")) return;

  const update = table === "faq_articles"
    ? { published, status: published ? "published" : "draft", published_at: published ? new Date().toISOString() : null, updated_at: new Date().toISOString() }
    : { published, updated_at: new Date().toISOString() };
  const { error } = await admin.from(table).update(update).eq("id", id);
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

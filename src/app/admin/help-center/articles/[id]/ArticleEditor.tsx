"use client";

import { useState } from "react";
import { MarkdownPreview } from "@/components/MarkdownPreview";

type Category = { id: string; name: string; locale: string };
type Article = {
  id?: string; title?: string; slug?: string; excerpt?: string; category_id?: string; locale?: string;
  body_md?: string; tags?: string[]; status?: string; seo_title?: string | null;
  seo_description?: string | null; featured?: boolean; reading_minutes?: number;
};

export function ArticleEditor({ action, categories, article }: { action: (formData: FormData) => void; categories: Category[]; article: Article | null }) {
  const [locale, setLocale] = useState(article?.locale ?? "es-CL");
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [body, setBody] = useState(article?.body_md ?? "");
  const [preview, setPreview] = useState(false);
  const [generatorTopic, setGeneratorTopic] = useState("");

  function generateDraft() {
    const topic = generatorTopic.trim() || title.trim();
    if (!topic) return;
    const generatedSlug = topic.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setTitle(title || topic);
    setSlug(slug || generatedSlug);
    if (!body) setBody(`# ${topic}\n\n## Antes de comenzar\n\nEn esta guía aprenderás a usar esta función de TuLector paso a paso.\n\n## Pasos\n\n1. Ingresa a tu cuenta de TuLector.\n2. Abre la sección correspondiente.\n3. Completa la configuración y guarda los cambios.\n\n## Si tienes problemas\n\nVerifica que estés usando la versión más reciente y que los datos estén completos. Si el problema continúa, [contacta a soporte](https://tulector.app/es-MX/support).\n\n## Preguntas frecuentes\n\n**¿Necesito ayuda adicional?**\n\nPuedes crear un ticket y compartir capturas o el mensaje exacto que aparece en pantalla.`);
    setGeneratorTopic("");
  }

  const matchingCategories = categories.filter((category) => category.locale === locale);

  return (
    <form action={action} className="space-y-5">
      {article?.id && <input type="hidden" name="id" value={article.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Título" hint="Claro y orientado a una tarea."><input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required className="field" /></Field>
        <Field label="Slug (URL)"><input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={160} required className="field" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Idioma"><select name="locale" value={locale} onChange={(e) => setLocale(e.target.value)} className="field"><option value="es-CL">es-CL</option><option value="es-MX">es-MX</option><option value="es-PE">es-PE</option><option value="es-AR">es-AR</option><option value="pt-BR">pt-BR</option></select></Field>
        <Field label="Categoría"><select name="category_id" defaultValue={article?.category_id ?? ""} required className="field"><option value="" disabled>Selecciona una categoría...</option>{matchingCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
      </div>
      <Field label="Resumen" hint="Se muestra en las tarjetas y en buscadores."><textarea name="excerpt" defaultValue={article?.excerpt ?? ""} maxLength={300} rows={2} className="field" /></Field>
      <div className="rounded-md border border-[#cfe0f5] bg-[#f5f9ff] p-4">
        <p className="text-sm font-bold text-[#07305f]">Generador de borrador</p>
        <p className="mt-1 text-xs text-[#4b5563]">Crea una estructura inicial editable. El resultado nunca se publica automáticamente.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={generatorTopic} onChange={(e) => setGeneratorTopic(e.target.value)} placeholder="Tema del artículo, por ejemplo: exportar resultados" className="field flex-1" /><button type="button" onClick={generateDraft} className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-bold text-white hover:bg-[#0b3f78]">Generar borrador</button></div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="body_md" className="text-sm font-semibold">Contenido Markdown</label><button type="button" onClick={() => setPreview((value) => !value)} className="text-xs font-bold text-[#2563eb]">{preview ? "Editar contenido" : "Ver vista previa"}</button></div>
        {preview ? <div className="min-h-[360px] rounded-md border border-[#cfd6df] bg-white p-5"><MarkdownPreview value={body} /></div> : <textarea id="body_md" name="body_md" value={body} onChange={(e) => setBody(e.target.value)} required rows={18} className="field min-h-[360px] font-mono text-sm" />}
        {preview && <textarea name="body_md" value={body} onChange={(e) => setBody(e.target.value)} className="sr-only" aria-hidden="true" />}
      </div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Tags" hint="Separados por coma."><input name="tags" defaultValue={article?.tags?.join(", ") ?? ""} className="field" /></Field><Field label="Lectura estimada (minutos)"><input type="number" name="reading_minutes" min={1} max={60} defaultValue={article?.reading_minutes ?? 3} className="field" /></Field></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="SEO title"><input name="seo_title" defaultValue={article?.seo_title ?? ""} maxLength={160} className="field" /></Field><Field label="SEO description"><textarea name="seo_description" defaultValue={article?.seo_description ?? ""} maxLength={200} rows={2} className="field" /></Field></div>
      <div className="flex flex-wrap items-center gap-4"><label className="text-sm font-semibold">Estado<select name="status" defaultValue={article?.status ?? "draft"} className="field ml-2 inline-block w-auto"><option value="draft">Borrador</option><option value="review">En revisión</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="featured" defaultChecked={article?.featured ?? false} /> Destacado</label></div>
      <button type="submit" className="rounded-md bg-[#07305f] px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-[#0b3f78]">Guardar artículo</button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-[#111827]"><span>{label}</span>{hint && <span className="ml-2 text-xs font-normal text-[#6b7280]">{hint}</span>}<span className="mt-1 block">{children}</span></label>; }

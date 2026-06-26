import { updateLocale } from "@/app/dashboard/actions";
import type { DashboardLocale } from "@/locales";

export function LanguageSwitcher({ locale }: { locale: DashboardLocale }) {
  return (
    <form action={updateLocale} className="flex items-center gap-2">
      <label htmlFor="locale" className="text-sm font-semibold text-[#4b5563]">Idioma</label>
      <select id="locale" name="locale" defaultValue={locale} className="rounded-md border border-[#d8dde3] bg-white px-3 py-2 text-sm">
        <option value="es-CL">ES/CL</option>
        <option value="en">EN</option>
        <option value="pt-BR">PT-BR</option>
      </select>
      <button className="rounded-md border border-[#d8dde3] px-3 py-2 text-sm font-semibold">Guardar</button>
    </form>
  );
}

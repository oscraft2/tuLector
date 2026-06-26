export function CSVImport({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  return (
    <form action={action} className="rounded-md border border-[#e6e8eb] bg-white p-5">
      <label className="block text-sm font-semibold text-[#111827]" htmlFor="csv">Importar CSV de alumnos</label>
      <p className="mt-1 text-sm text-[#4b5563]">Columnas soportadas: rut, nombre, curso. Se valida RUT chileno y se evita duplicar por colegio.</p>
      <textarea id="csv" name="csv" rows={8} className="mt-4 w-full rounded-md border border-[#d8dde3] px-3 py-2 text-sm outline-none focus:border-[#111827]" placeholder="rut,nombre,curso&#10;12345678-5,Ana Perez,IV Medio A" />
      <button className="mt-4 rounded-md bg-[#111827] px-4 py-2 text-sm font-semibold text-white">Importar</button>
    </form>
  );
}

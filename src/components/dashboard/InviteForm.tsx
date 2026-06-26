export function InviteForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  return (
    <form action={action} className="rounded-md border border-[#e6e8eb] bg-white p-5">
      <h2 className="text-base font-semibold text-[#111827]">Invitar miembro</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]">
        <input name="email" type="email" required placeholder="correo@colegio.cl" className="rounded-md border border-[#d8dde3] px-3 py-2 text-sm outline-none focus:border-[#111827]" />
        <select name="role" className="rounded-md border border-[#d8dde3] px-3 py-2 text-sm outline-none focus:border-[#111827]" defaultValue="teacher">
          <option value="admin">Admin</option>
          <option value="teacher">Profesor</option>
          <option value="viewer">Observador</option>
        </select>
        <button className="rounded-md bg-[#111827] px-4 py-2 text-sm font-semibold text-white">Invitar</button>
      </div>
    </form>
  );
}

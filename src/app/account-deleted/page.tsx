import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: "/account-deleted" },
};

/** Confirmacion tras eliminar la cuenta (deleteMyAccount en dashboard/actions.ts). */
export default function AccountDeletedPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#f8faf9] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#111827] text-lg font-black text-white">TL</div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[#111827]">Tu cuenta fue eliminada</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#5b6472]">
        Tu perfil y acceso a TuLector con este correo fueron eliminados. Si vuelves a necesitar la plataforma, puedes crear una cuenta nueva cuando quieras.
      </p>
      <Link href="/auth" className="mt-8 rounded-lg bg-[#123b5d] px-5 py-3 text-sm font-bold text-white hover:bg-[#0f2f49]">
        Volver al inicio
      </Link>
    </main>
  );
}

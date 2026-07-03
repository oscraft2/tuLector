"use client";

export function PrintButton({ label = "Imprimir informe", className }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className ?? "rounded-md border border-[#cfd6df] bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50 print:hidden"}
    >
      {label}
    </button>
  );
}

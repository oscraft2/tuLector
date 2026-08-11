import Link from "next/link";

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** Query string base (sin `page`), para conservar los filtros al navegar. */
  baseQuery: URLSearchParams;
  /** Ruta de destino. Default: la misma pagina. */
  basePath?: string;
};

/**
 * Paginador de servidor: enlaces reales que cambian `?page=`, sin estado en el
 * cliente. Asi la pagina sigue siendo un Server Component y cada vista trae
 * solo su tramo de filas.
 */
export function Pagination({ page, pageCount, total, pageSize, baseQuery, basePath = "" }: PaginationProps) {
  if (pageCount <= 1) return null;

  const href = (p: number) => {
    const params = new URLSearchParams(baseQuery.toString());
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const linkClass = "rounded-md border border-[#cfd6df] bg-white px-3 py-1.5 text-xs font-semibold text-[#07305f] hover:bg-[#f4f6f8]";
  const disabledClass = "rounded-md border border-[#eef0f3] bg-[#f8fafc] px-3 py-1.5 text-xs font-semibold text-[#c2c8d0]";

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Paginacion de alumnos">
      <p className="text-xs text-[#5b6472]">
        Mostrando <strong>{from}–{to}</strong> de <strong>{total}</strong> · pagina {page} de {pageCount}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={linkClass} rel="prev">← Anterior</Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">← Anterior</span>
        )}
        {page < pageCount ? (
          <Link href={href(page + 1)} className={linkClass} rel="next">Siguiente →</Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">Siguiente →</span>
        )}
      </div>
    </nav>
  );
}

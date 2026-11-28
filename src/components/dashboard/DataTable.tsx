type DataTableProps<T> = {
  columns: readonly string[];
  rows: readonly T[];
  empty: string;
  renderRow: (row: T) => React.ReactNode;
  renderMobileRow?: (row: T) => React.ReactNode;
};

export function DataTable<T>({ columns, rows, empty, renderRow, renderMobileRow }: DataTableProps<T>) {
  if (renderMobileRow) {
    return (
      <>
        <div className="grid gap-3 md:hidden">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-[#e7e5df] bg-white px-4 py-8 text-center text-sm text-[#78716c]">{empty}</div>
          ) : rows.map(renderMobileRow)}
        </div>
        <TableShell columns={columns} rows={rows} empty={empty} renderRow={renderRow} className="hidden md:block" />
      </>
    );
  }

  return <TableShell columns={columns} rows={rows} empty={empty} renderRow={renderRow} />;
}

function TableShell<T>({
  columns,
  rows,
  empty,
  renderRow,
  className = "",
}: {
  columns: readonly string[];
  rows: readonly T[];
  empty: string;
  renderRow: (row: T) => React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-[#e7e5df] bg-white shadow-xs ${className}`}>
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-[#faf9f6]">
          <tr className="border-b border-[#e7e5df] text-xs font-semibold uppercase tracking-[0.08em] text-[#78716c]">
            {columns.map((column) => <th key={column} scope="col" className="px-5 py-3">{column}</th>)}
          </tr>
        </thead>
        <tbody className="[&>tr]:transition-colors [&>tr:hover]:bg-[#faf9f6]/80">
          {rows.length === 0 ? (
            <tr><td className="px-5 py-8 text-center text-[#78716c]" colSpan={columns.length}>{empty}</td></tr>
          ) : rows.map(renderRow)}
        </tbody>
      </table>
    </div>
  );
}

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
            <div className="rounded-md border border-[#e6e8eb] bg-white px-4 py-8 text-center text-sm text-[#6b7280]">{empty}</div>
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
    <div className={`overflow-x-auto rounded-md border border-[#e6e8eb] bg-white ${className}`}>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-[#e6e8eb] text-xs uppercase tracking-[0.1em] text-[#6b7280]">
            {columns.map((column) => <th key={column} scope="col" className="px-5 py-3 font-semibold">{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="px-5 py-8 text-center text-[#6b7280]" colSpan={columns.length}>{empty}</td></tr>
          ) : rows.map(renderRow)}
        </tbody>
      </table>
    </div>
  );
}
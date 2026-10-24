interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  emptyLabel?: string;
}

export function AdminTable<T>({ columns, rows, keyFn, emptyLabel = 'No records' }: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-cyan-300/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cyan-300/[0.04] border-b border-cyan-300/10">
            {columns.map(col => (
              <th
                key={col.key}
                className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-cyan-300/[0.06]">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center text-gray-500 text-sm py-10">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map(row => (
              <tr key={keyFn(row)} className="bg-gray-900/20 hover:bg-cyan-400/[0.04] transition-colors">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-gray-300">
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

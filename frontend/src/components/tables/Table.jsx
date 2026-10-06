import Card from "../common/Card";
import { TableSkeleton } from "../common/Loading";
import EmptyState from "../common/EmptyState";
import ErrorState from "../common/ErrorState";
import Pagination from "../common/Pagination";

/**
 * Generic data table used by every module (Giveaways, Inventory, Generator,
 * Attendance, Reports...). Columns: [{ key, header, render?(row), width? }].
 * Pass `loading`/`error`/empty data and this renders the right state.
 */
export default function Table({
  columns,
  data = [],
  loading = false,
  error = false,
  errorDescription,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  keyField = "id",
  pagination, // { page, totalPages, totalItems, pageSize, onPageChange }
}) {
  return (
    <Card padding={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-subtle border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className="px-4 py-3 text-helper font-semibold text-ink-secondary uppercase tracking-wide whitespace-nowrap"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          {!loading && !error && data.length > 0 && (
            <tbody>
              {data.map((row) => (
                <tr
                  key={row[keyField]}
                  className="border-b border-border last:border-0 hover:bg-surface-subtle/60 transition-colors duration-150"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5 text-body text-ink align-middle whitespace-nowrap">
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {loading && <TableSkeleton columns={columns.length} />}
        {!loading && error && (
          <ErrorState onRetry={onRetry} description={errorDescription || "We couldn't load this data. Please try again."} />
        )}
        {!loading && !error && data.length === 0 && (
          <EmptyState
            title={emptyTitle || "No records found"}
            description={emptyDescription || "There are currently no items to display."}
            actionLabel={emptyAction?.label}
            onAction={emptyAction?.onClick}
          />
        )}
      </div>
      {!loading && !error && data.length > 0 && pagination && <Pagination {...pagination} />}
    </Card>
  );
}

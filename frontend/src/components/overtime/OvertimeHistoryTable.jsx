import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { overtimeService } from "../../services/overtimeService";
import Table from "../tables/Table";
import Badge from "../common/Badge";
import { formatDate, formatDuration } from "../../utils/attendanceFormat";

const PAGE_SIZE = 10;

// Request status values already match the keys in config/theme.js statusStyles.
const columns = [
  { key: "date", header: "Date", render: (row) => formatDate(row.date) },
  { key: "overtimeMinutes", header: "Overtime", render: (row) => formatDuration(row.overtimeMinutes) },
  { key: "status", header: "Status", render: (row) => <Badge status={row.status} /> },
  { key: "reviewedBy", header: "Reviewed by", render: (row) => row.reviewedBy?.name ?? "—" },
  {
    key: "reviewNote",
    header: "Note",
    render: (row) =>
      row.reviewNote ? (
        <span className="block max-w-[16rem] truncate" title={row.reviewNote}>
          {row.reviewNote}
        </span>
      ) : (
        "—"
      ),
  },
];

/**
 * The signed-in user's own overtime requests, newest first. Always filters by
 * the current user's id — reviewers can read everyone's requests via the API,
 * but this table is "my overtime".
 */
export default function OvertimeHistoryTable() {
  const { user } = useAuth();
  const userId = user?._id;

  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  // `page` here is the page the data belongs to; loading = requested page hasn't arrived yet.
  const [result, setResult] = useState({ page: null, items: [], pagination: null, failed: false });
  const loading = result.page !== page;

  useEffect(() => {
    let cancelled = false;
    overtimeService
      .list({ userId, page, pageSize: PAGE_SIZE })
      .then(({ items, pagination }) => {
        if (!cancelled) setResult({ page, items, pagination, failed: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ page, items: [], pagination: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, page, attempt]);

  const retry = () => {
    setResult((r) => ({ ...r, page: null }));
    setAttempt((a) => a + 1);
  };

  const { pagination } = result;

  return (
    <Table
      columns={columns}
      data={result.items}
      keyField="_id"
      loading={loading}
      error={!loading && result.failed}
      onRetry={retry}
      emptyTitle="No overtime yet"
      emptyDescription="Time worked beyond standard duty hours is added here automatically when you clock out."
      pagination={
        pagination && {
          page: pagination.page,
          totalPages: pagination.totalPages,
          totalItems: pagination.totalItems,
          pageSize: pagination.pageSize,
          onPageChange: setPage,
        }
      }
    />
  );
}

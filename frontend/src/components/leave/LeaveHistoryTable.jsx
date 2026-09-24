import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { leaveService } from "../../services/leaveService";
import Table from "../tables/Table";
import Badge from "../common/Badge";
import { formatLeaveDate, leaveTypeLabel } from "../../utils/leaveFormat";

const PAGE_SIZE = 10;

// Request status values already match the keys in config/theme.js statusStyles.
const columns = [
  { key: "leaveType", header: "Type", render: (row) => leaveTypeLabel[row.leaveType] ?? row.leaveType },
  {
    key: "dates",
    header: "Dates",
    render: (row) => {
      const start = formatLeaveDate(row.startDate);
      return row.totalDays > 1 ? `${start} – ${formatLeaveDate(row.endDate)}` : start;
    },
  },
  { key: "totalDays", header: "Days", render: (row) => row.totalDays },
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
 * The signed-in user's own leave requests, newest first. Always filters by the
 * current user's id — reviewers can read everyone's requests via the API, but
 * this table is "my leave". Change `refreshKey` to re-fetch (e.g. after a new
 * request) without flashing the loading skeleton.
 */
export default function LeaveHistoryTable({ refreshKey = 0 }) {
  const { user } = useAuth();
  const userId = user?._id;

  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  // `page` here is the page the data belongs to; loading = requested page hasn't arrived yet.
  const [result, setResult] = useState({ page: null, items: [], pagination: null, failed: false });
  const loading = result.page !== page;

  useEffect(() => {
    let cancelled = false;
    leaveService
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
  }, [userId, page, refreshKey, attempt]);

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
      emptyTitle="No leave requests yet"
      emptyDescription="Requests you submit will show up here with their approval status."
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

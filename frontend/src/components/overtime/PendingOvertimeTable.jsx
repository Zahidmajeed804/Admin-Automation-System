import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { overtimeService } from "../../services/overtimeService";
import Table from "../tables/Table";
import Button from "../common/Button";
import ReviewOvertimeDialog from "./ReviewOvertimeDialog";
import { formatDate, formatDuration } from "../../utils/attendanceFormat";

const PAGE_SIZE = 10;

/**
 * Overtime requests waiting for a decision, across all employees (reviewer
 * view). Approve/reject go through a confirmation dialog; the list refreshes
 * in place afterwards, so a decided request drops out.
 */
export default function PendingOvertimeTable() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  // Bumped after a decision to re-fetch in place, without the loading skeleton.
  const [refreshKey, setRefreshKey] = useState(0);
  const [review, setReview] = useState(null); // { request, decision }
  // `page` here is the page the data belongs to; loading = requested page hasn't arrived yet.
  const [result, setResult] = useState({ page: null, items: [], pagination: null, failed: false });
  const loading = result.page !== page;

  useEffect(() => {
    let cancelled = false;
    overtimeService
      .list({ status: "pending", page, pageSize: PAGE_SIZE })
      .then(({ items, pagination }) => {
        if (cancelled) return;
        // Deciding the last request on a later page empties it; step back a page.
        if (items.length === 0 && page > 1) setPage(page - 1);
        else setResult({ page, items, pagination, failed: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ page, items: [], pagination: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [page, refreshKey, attempt]);

  const retry = () => {
    setResult((r) => ({ ...r, page: null }));
    setAttempt((a) => a + 1);
  };

  const columns = [
    {
      key: "employee",
      header: "Employee",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink">{row.user?.name || "Unknown user"}</span>
          {row.user?.department && <span className="text-helper text-ink-muted">{row.user.department}</span>}
        </div>
      ),
    },
    { key: "date", header: "Date", render: (row) => formatDate(row.date) },
    { key: "overtimeMinutes", header: "Overtime", render: (row) => formatDuration(row.overtimeMinutes) },
    {
      key: "actions",
      header: "",
      render: (row) => {
        // The API forbids reviewing your own request, so don't offer it.
        const own = row.user?._id === user?._id;
        const who = row.user?.name || "unknown user";
        const when = formatDate(row.date);
        const hint = own ? "You can't review your own overtime request" : undefined;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Check}
              disabled={own}
              title={hint}
              aria-label={`Approve overtime for ${who} on ${when}`}
              onClick={() => setReview({ request: row, decision: "approved" })}
            >
              Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              disabled={own}
              title={hint}
              aria-label={`Reject overtime for ${who} on ${when}`}
              onClick={() => setReview({ request: row, decision: "rejected" })}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  const { pagination } = result;

  return (
    <>
      <Table
        columns={columns}
        data={result.items}
        keyField="_id"
        loading={loading}
        error={!loading && result.failed}
        onRetry={retry}
        emptyTitle="Nothing to approve"
        emptyDescription="Overtime requests appear here once employees clock out after standard duty hours."
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
      <ReviewOvertimeDialog
        request={review?.request}
        decision={review?.decision}
        onClose={() => setReview(null)}
        onDone={() => {
          setReview(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    </>
  );
}

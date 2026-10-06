import { useEffect, useState } from "react";
import { CalendarClock, Check, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { leaveService } from "../../services/leaveService";
import Table from "../tables/Table";
import LeaveDaysCell from "./LeaveDaysCell";
import Button from "../common/Button";
import ReviewLeaveDialog from "./ReviewLeaveDialog";
import EditLeaveDatesDialog from "./EditLeaveDatesDialog";
import { canEditLeaveDates, editedNotice, formatLeaveDate, leaveTypeLabel } from "../../utils/leaveFormat";

const PAGE_SIZE = 10;

/**
 * Leave requests waiting for a decision, across all employees (reviewer view).
 * Approve and Reject are separate permissions, so each button only appears for
 * a user who holds it. Decisions go through a confirmation dialog; the list
 * refreshes in place afterwards, so a decided request drops out. Change the
 * `refreshKey` prop to re-fetch from outside (e.g. after the reviewer files
 * their own request).
 */
export default function PendingLeaveTable({ canApprove, canReject, refreshKey: externalRefreshKey = 0 }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  // Bumped after a decision to re-fetch in place, without the loading skeleton.
  const [refreshKey, setRefreshKey] = useState(0);
  const [review, setReview] = useState(null); // { request, decision }
  const [editing, setEditing] = useState(null); // request whose dates are being changed
  const [notice, setNotice] = useState("");
  // `page` here is the page the data belongs to; loading = requested page hasn't arrived yet.
  const [result, setResult] = useState({ page: null, items: [], pagination: null, failed: false });
  const loading = result.page !== page;

  useEffect(() => {
    let cancelled = false;
    leaveService
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
  }, [page, refreshKey, externalRefreshKey, attempt]);

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
    { key: "leaveType", header: "Type", render: (row) => leaveTypeLabel[row.leaveType] ?? row.leaveType },
    {
      key: "dates",
      header: "Dates",
      render: (row) =>
        row.totalDays > 1
          ? `${formatLeaveDate(row.startDate)} – ${formatLeaveDate(row.endDate)}`
          : formatLeaveDate(row.startDate),
    },
    { key: "totalDays", header: "Days", render: (row) => <LeaveDaysCell request={row} /> },
    {
      key: "reason",
      header: "Reason",
      render: (row) =>
        row.reason ? (
          <span className="block max-w-[14rem] truncate" title={row.reason}>
            {row.reason}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        // The API forbids reviewing your own request, so don't offer it.
        const own = row.user?._id === user?._id;
        const who = row.user?.name || "unknown user";
        const when = formatLeaveDate(row.startDate);
        const hint = own ? "You can't review your own leave request" : undefined;
        return (
          <div className="flex items-center gap-2">
            {canEditLeaveDates(row) && (
              <Button
                variant="ghost"
                size="sm"
                icon={CalendarClock}
                disabled={own}
                title={own ? "You can't change the dates of your own leave request" : undefined}
                aria-label={`Edit dates of leave for ${who} starting ${when}`}
                onClick={() => {
                  setNotice("");
                  setEditing(row);
                }}
              >
                Edit dates
              </Button>
            )}
            {canApprove && (
              <Button
                variant="secondary"
                size="sm"
                icon={Check}
                disabled={own}
                title={hint}
                aria-label={`Approve leave for ${who} starting ${when}`}
                onClick={() => setReview({ request: row, decision: "approved" })}
              >
                Approve
              </Button>
            )}
            {canReject && (
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                disabled={own}
                title={hint}
                aria-label={`Reject leave for ${who} starting ${when}`}
                onClick={() => setReview({ request: row, decision: "rejected" })}
              >
                Reject
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const { pagination } = result;

  return (
    <>
      {notice && (
        <div
          role="status"
          className="bg-status-successBg border border-green-200 text-status-success text-body rounded-md px-3 py-2 mb-4"
        >
          {notice}
        </div>
      )}
      <Table
        columns={columns}
        data={result.items}
        keyField="_id"
        loading={loading}
        error={!loading && result.failed}
        onRetry={retry}
        emptyTitle="Nothing to approve"
        emptyDescription="Leave requests appear here once employees submit them."
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
      <ReviewLeaveDialog
        request={review?.request}
        decision={review?.decision}
        onClose={() => setReview(null)}
        onDone={() => {
          setReview(null);
          setNotice("");
          setRefreshKey((k) => k + 1);
        }}
      />
      <EditLeaveDatesDialog
        request={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setEditing(null);
          setNotice(editedNotice(updated));
          setRefreshKey((k) => k + 1);
        }}
      />
    </>
  );
}

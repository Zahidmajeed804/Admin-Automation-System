import { useEffect, useState } from "react";
import { CalendarClock, Check, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { leaveService } from "../../services/leaveService";
import { userService } from "../../services/userService";
import FilterBar from "../common/FilterBar";
import Select from "../common/Select";
import DatePicker from "../common/DatePicker";
import Button from "../common/Button";
import Badge from "../common/Badge";
import Table from "../tables/Table";
import LeaveDaysCell from "./LeaveDaysCell";
import ReviewLeaveDialog from "./ReviewLeaveDialog";
import EditLeaveDatesDialog from "./EditLeaveDatesDialog";
import {
  canEditLeaveDates,
  editedNotice,
  formatLeaveDate,
  leaveTypeLabel,
  leaveTypeOptions,
} from "../../utils/leaveFormat";

const PAGE_SIZE = 10;

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const typeFilterOptions = [{ value: "", label: "All types" }, ...leaveTypeOptions];

const noFilters = { userId: "", status: "", leaveType: "", startDate: "", endDate: "" };

const employeeColumn = {
  key: "employee",
  header: "Employee",
  render: (row) => (
    <div className="flex flex-col">
      <span className="font-medium text-ink">{row.user?.name || "Unknown user"}</span>
      {row.user?.department && <span className="text-helper text-ink-muted">{row.user.department}</span>}
    </div>
  ),
};

/**
 * Leave requests for everyone (reviewer view), filterable by employee, status,
 * leave type and date range — same shape as TeamAttendanceTable. Approve and
 * Reject are separate permissions and only appear on pending rows the
 * signed-in reviewer didn't request themselves.
 */
export default function TeamLeaveTable({ canApprove, canReject, refreshKey: externalRefreshKey = 0 }) {
  const { user } = useAuth();
  const [filters, setFilters] = useState(noFilters);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  // Bumped after a decision (or by the caller, e.g. after the reviewer files their
  // own request) to re-fetch in place, without the loading skeleton.
  const [refreshKey, setRefreshKey] = useState(0);
  const [review, setReview] = useState(null); // { request, decision }
  const [editing, setEditing] = useState(null); // request whose dates are being changed
  const [notice, setNotice] = useState("");
  const [employees, setEmployees] = useState([]);
  const [employeesFailed, setEmployeesFailed] = useState(false);
  // `key` identifies the request the data belongs to; loading = it hasn't arrived yet.
  const [result, setResult] = useState({ key: null, items: [], pagination: null, failed: false });

  const requestKey = JSON.stringify([filters, page, attempt]);
  const loading = result.key !== requestKey;
  const hasFilters = Object.values(filters).some(Boolean);

  useEffect(() => {
    userService
      .options()
      .then(setEmployees)
      .catch(() => setEmployeesFailed(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    leaveService
      .list({ ...filters, page, pageSize: PAGE_SIZE })
      .then(({ items, pagination }) => {
        if (!cancelled) setResult({ key: requestKey, items, pagination, failed: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, items: [], pagination: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [filters, page, requestKey, refreshKey, externalRefreshKey]);

  const setFilter = (name, value) => {
    setFilters((f) => {
      const next = { ...f, [name]: value };
      // Keep the range valid (the API rejects endDate < startDate): moving one
      // bound past the other drags the other bound along.
      if (next.startDate && next.endDate && next.endDate < next.startDate) {
        if (name === "startDate") next.endDate = next.startDate;
        else next.startDate = next.endDate;
      }
      return next;
    });
    setPage(1);
  };

  const reset = () => {
    setFilters(noFilters);
    setPage(1);
  };

  const employeeOptions = [
    { value: "", label: "All employees" },
    ...employees.map((e) => ({
      value: e._id,
      label: e.isActive === false ? `${e.name} (inactive)` : e.name,
    })),
  ];

  const columns = [
    employeeColumn,
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
    { key: "status", header: "Status", render: (row) => <Badge status={row.status} /> },
    { key: "reviewedBy", header: "Reviewed by", render: (row) => row.reviewedBy?.name ?? "—" },
    {
      key: "actions",
      header: "",
      render: (row) => {
        if (row.status !== "pending") return null;
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
    <div className="flex flex-col gap-4">
      {notice && (
        <div
          role="status"
          className="bg-status-successBg border border-green-200 text-status-success text-body rounded-md px-3 py-2"
        >
          {notice}
        </div>
      )}
      <FilterBar
        onReset={hasFilters ? reset : undefined}
        filters={
          <>
            <Select
              label="Employee"
              name="userId"
              id="team-leave-filter-employee"
              className="sm:w-56"
              value={filters.userId}
              onChange={(e) => setFilter("userId", e.target.value)}
              options={employeeOptions}
              helperText={employeesFailed ? "Couldn't load employees" : undefined}
            />
            <Select
              label="Type"
              name="leaveType"
              id="team-leave-filter-type"
              className="sm:w-40"
              value={filters.leaveType}
              onChange={(e) => setFilter("leaveType", e.target.value)}
              options={typeFilterOptions}
            />
            <Select
              label="Status"
              name="status"
              id="team-leave-filter-status"
              className="sm:w-40"
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              options={statusOptions}
            />
            <DatePicker
              label="From"
              id="team-leave-filter-from"
              className="sm:w-40"
              clearable
              value={filters.startDate}
              max={filters.endDate || undefined}
              onChange={(v) => setFilter("startDate", v)}
            />
            <DatePicker
              label="To"
              id="team-leave-filter-to"
              className="sm:w-40"
              clearable
              value={filters.endDate}
              min={filters.startDate || undefined}
              onChange={(v) => setFilter("endDate", v)}
            />
          </>
        }
      />
      <Table
        columns={columns}
        data={result.items}
        keyField="_id"
        loading={loading}
        error={!loading && result.failed}
        onRetry={() => setAttempt((a) => a + 1)}
        emptyTitle={hasFilters ? "No matching requests" : "No leave requests yet"}
        emptyDescription={
          hasFilters ? "Try changing or resetting the filters." : "Requests appear here once employees submit them."
        }
        emptyAction={hasFilters ? { label: "Reset filters", onClick: reset } : undefined}
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
    </div>
  );
}

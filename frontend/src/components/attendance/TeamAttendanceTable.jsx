import { useEffect, useState } from "react";
import { attendanceService } from "../../services/attendanceService";
import FilterBar from "../common/FilterBar";
import Select from "../common/Select";
import Input from "../common/Input";
import Table from "../tables/Table";
import { attendanceColumns } from "./attendanceColumns";

const PAGE_SIZE = 10;

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "present", label: "Present" },
  { value: "half-day", label: "Half day" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
];

const noFilters = { userId: "", status: "", startDate: "", endDate: "" };

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
  ...attendanceColumns,
];

/**
 * Attendance records for everyone (manager/admin view), filterable by
 * employee, status and date range. The filters map 1:1 onto the
 * GET /attendance query params; any filter change goes back to page 1.
 */
export default function TeamAttendanceTable() {
  const [filters, setFilters] = useState(noFilters);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [employeesFailed, setEmployeesFailed] = useState(false);
  // `key` identifies the request the data belongs to; loading = it hasn't arrived yet.
  const [result, setResult] = useState({ key: null, items: [], pagination: null, failed: false });

  const requestKey = JSON.stringify([filters, page, attempt]);
  const loading = result.key !== requestKey;
  const hasFilters = Object.values(filters).some(Boolean);

  useEffect(() => {
    attendanceService
      .employees()
      .then(setEmployees)
      .catch(() => setEmployeesFailed(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    attendanceService
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
  }, [filters, page, requestKey]);

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

  const { pagination } = result;

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        onReset={hasFilters ? reset : undefined}
        filters={
          <>
            <Select
              label="Employee"
              name="userId"
              id="team-filter-employee"
              className="sm:w-56"
              value={filters.userId}
              onChange={(e) => setFilter("userId", e.target.value)}
              options={employeeOptions}
              helperText={employeesFailed ? "Couldn't load employees" : undefined}
            />
            <Select
              label="Status"
              name="status"
              id="team-filter-status"
              className="sm:w-40"
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              options={statusOptions}
            />
            <Input
              label="From"
              type="date"
              name="startDate"
              id="team-filter-from"
              className="sm:w-40"
              value={filters.startDate}
              max={filters.endDate || undefined}
              onChange={(e) => setFilter("startDate", e.target.value)}
            />
            <Input
              label="To"
              type="date"
              name="endDate"
              id="team-filter-to"
              className="sm:w-40"
              value={filters.endDate}
              min={filters.startDate || undefined}
              onChange={(e) => setFilter("endDate", e.target.value)}
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
        emptyTitle={hasFilters ? "No matching records" : "No attendance records yet"}
        emptyDescription={
          hasFilters ? "Try changing or resetting the filters." : "Records appear here once employees clock in."
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
    </div>
  );
}

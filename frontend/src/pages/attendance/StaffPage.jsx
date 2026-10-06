import { useEffect, useState } from "react";
import { UserPlus, Pencil, UserX, UserCheck, CalendarRange, BriefcaseBusiness } from "lucide-react";
import { userService } from "../../services/userService";
import { apiErrorMessage } from "../../utils/apiError";
import { formatShiftHours } from "../../utils/designationFormat";
import PageHeader from "../../components/common/PageHeader";
import AttendanceSectionNav from "../../components/attendance/AttendanceSectionNav";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Table from "../../components/tables/Table";
import ConfirmDialog from "../../components/modals/ConfirmDialog";
import StaffFormModal from "../../components/staff/StaffFormModal";
import AssignLeaveAllocationDialog from "../../components/staff/AssignLeaveAllocationDialog";
import DesignationsDialog from "../../components/staff/DesignationsDialog";

const PAGE_SIZE = 10;

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const noFilters = { search: "", status: "" };

/**
 * Admin-only staff directory: search, filter by status, and activate or
 * deactivate a login. Add/edit is handled by StaffFormModal (AAS-387).
 */
export default function StaffPage() {
  const [filters, setFilters] = useState(noFilters);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  // Bumped after create/edit/status change to re-fetch in place.
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusTarget, setStatusTarget] = useState(null); // the row being activated/deactivated
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null); // null = creating a new staff member
  const [assignOpen, setAssignOpen] = useState(false);
  // { matched, modified, designationName? } from the last bulk apply
  const [assignResult, setAssignResult] = useState(null);
  const [designationsOpen, setDesignationsOpen] = useState(false);
  const [result, setResult] = useState({ key: null, items: [], pagination: null, failed: false });

  const requestKey = JSON.stringify([filters, page, attempt]);
  const loading = result.key !== requestKey;
  const hasFilters = Object.values(filters).some(Boolean);

  useEffect(() => {
    let cancelled = false;
    userService
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
  }, [filters, page, requestKey, refreshKey]);

  const setFilter = (name, value) => {
    setFilters((f) => ({ ...f, [name]: value }));
    setPage(1);
  };

  const reset = () => {
    setFilters(noFilters);
    setPage(1);
  };

  const openCreate = () => {
    setEditingStaff(null);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditingStaff(row);
    setFormOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    setStatusSaving(true);
    setStatusError("");
    try {
      await userService.setActive(statusTarget._id, !statusTarget.isActive);
      setStatusTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setStatusError(apiErrorMessage(err, "Couldn't update this account. Please try again."));
    } finally {
      setStatusSaving(false);
    }
  };

  const columns = [
    {
      key: "employeeId",
      header: "Employee ID",
      render: (row) => <span className="font-medium text-ink">{row.employeeId || "—"}</span>,
    },
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink">{row.name}</span>
          {row.department && <span className="text-helper text-ink-muted">{row.department}</span>}
        </div>
      ),
    },
    {
      key: "designation",
      header: "Designation",
      render: (row) =>
        row.designation ? (
          <div className="flex flex-col">
            <span className="text-ink">{row.designation.name}</span>
            <span className="text-helper text-ink-muted">{formatShiftHours(row.designation.shiftHours)} shift</span>
          </div>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    { key: "email", header: "Email" },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge status={row.isActive ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={Pencil}
            aria-label={`Edit ${row.name}`}
            onClick={() => openEdit(row)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={row.isActive ? UserX : UserCheck}
            aria-label={row.isActive ? `Deactivate ${row.name}` : `Activate ${row.name}`}
            onClick={() => {
              setStatusError("");
              setStatusTarget(row);
            }}
          >
            {row.isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  const { pagination } = result;

  return (
    <>
      <PageHeader
        title="Staff"
        description="Add staff logins, assign Employee IDs, and activate or deactivate accounts."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon={BriefcaseBusiness} onClick={() => setDesignationsOpen(true)}>
              Designations
            </Button>
            <Button variant="secondary" icon={CalendarRange} onClick={() => setAssignOpen(true)}>
              Assign leaves
            </Button>
            <Button icon={UserPlus} onClick={openCreate}>
              Add staff
            </Button>
          </div>
        }
      />
      <AttendanceSectionNav />
      {assignResult && (
        <div
          role="status"
          className="bg-status-successBg border border-green-200 text-status-success text-body rounded-md px-3 py-2"
        >
          Leave allocation applied to {assignResult.modified} of {assignResult.matched} matching staff member(s)
          {assignResult.designationName ? ` with the ${assignResult.designationName} designation` : ""}.
        </div>
      )}
      <div className="flex flex-col gap-4">
        <FilterBar
          search={filters.search}
          onSearchChange={(v) => setFilter("search", v)}
          searchPlaceholder="Search name, email or Employee ID"
          onReset={hasFilters ? reset : undefined}
          filters={
            <Select
              label="Status"
              name="status"
              id="staff-filter-status"
              className="sm:w-40"
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              options={statusOptions}
            />
          }
        />
        <Table
          columns={columns}
          data={result.items}
          keyField="_id"
          loading={loading}
          error={!loading && result.failed}
          onRetry={() => setAttempt((a) => a + 1)}
          emptyTitle={hasFilters ? "No matching staff" : "No staff members yet"}
          emptyDescription={
            hasFilters ? "Try changing or resetting the filters." : "Add your first staff login to get started."
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
      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => (statusSaving ? null : setStatusTarget(null))}
        onConfirm={confirmStatusChange}
        title={statusTarget?.isActive ? "Deactivate staff member?" : "Activate staff member?"}
        description={
          statusTarget?.isActive
            ? `${statusTarget?.name} will no longer be able to log in. Their attendance, overtime and leave history is kept, and the account can be re-activated later.`
            : `${statusTarget?.name} will be able to log in again.`
        }
        confirmLabel={statusTarget?.isActive ? "Deactivate" : "Activate"}
        variant={statusTarget?.isActive ? "danger" : "primary"}
        loading={statusSaving}
        error={statusError}
      />
      <StaffFormModal
        open={formOpen}
        staff={editingStaff}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />
      <DesignationsDialog
        open={designationsOpen}
        onClose={() => setDesignationsOpen(false)}
        // Renames and shift changes show up in the Designation column.
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
      <AssignLeaveAllocationDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onDone={(result, designationName) => {
          setAssignOpen(false);
          setAssignResult({ ...result, designationName });
          // Rows carry each person's allocation; reload so they show the new values.
          setRefreshKey((k) => k + 1);
        }}
      />
    </>
  );
}

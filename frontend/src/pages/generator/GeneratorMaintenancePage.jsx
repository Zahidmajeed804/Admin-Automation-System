import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, Ban, Paperclip, AlertTriangle, Clock3, Eye } from "lucide-react";
import clsx from "clsx";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/modals/ConfirmDialog";
import Table from "../../components/tables/Table";
import GeneratorMaintenanceForm from "./GeneratorMaintenanceForm";
import GeneratorMaintenanceCompleteForm from "./GeneratorMaintenanceCompleteForm";
import GeneratorMaintenanceInvoice from "./GeneratorMaintenanceInvoice";
import GeneratorMaintenanceDetails from "./GeneratorMaintenanceDetails";
import { extractErrorMessage } from "./GeneratorForm";
import { useAuth } from "../../context/AuthContext";
import { generatorService } from "../../services/generatorService";
import { formatDate } from "../../utils/formatDate";
import { formatNumber } from "../../utils/formatNumber";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

// A job can be due by date, by running hours, both, or neither (see the
// backend's computeAlertStatus) — this shows whichever of the two the job
// actually tracks. Overdue reads as "by" (how far past), everything else as
// "in" (how far ahead), matching how a person would say either out loud.
// Exported for reuse by GeneratorMaintenanceDetails, which shows the same
// due-in line in its own layout.
export function dueInLine(value, unit) {
  if (value === undefined || value === null) return null;
  return value < 0 ? `Overdue by ${formatNumber(-value)}${unit}` : `Due in ${formatNumber(value)}${unit}`;
}

export function DueInfo({ row }) {
  if (row.status !== "scheduled") return null;
  const days = dueInLine(row.daysUntilDue, "d");
  const hours = dueInLine(row.hoursUntilDue, "h");
  if (!days && !hours) return null;
  const overdue = row.alertStatus === "overdue";
  return (
    <p className={clsx("text-helper mt-0.5", overdue ? "text-status-error font-medium" : "text-ink-muted")}>
      {[days, hours].filter(Boolean).join(" · ")}
    </p>
  );
}

// `onEdit` / `onComplete` / `onCancel` / `onDelete` are left undefined for a
// user without the matching permission, and then that button is not drawn at
// all — the same pattern GeneratorPage uses. Editing, completing and
// cancelling only make sense for a job still "scheduled" — completed/
// cancelled jobs are history, and the backend refuses all three anyway — so
// those three are also skipped for rows that aren't. The invoice action has
// no such restriction: a job can carry an invoice at any status.
function buildColumns({ onView, onEdit, onComplete, onCancel, onInvoice, onDelete }) {
  return [
    { key: "generator", header: "Generator", render: (row) => <span className="font-medium text-ink">{row.generator?.tag ?? "—"}</span> },
    { key: "description", header: "Description" },
    { key: "type", header: "Type", render: (row) => <span className="capitalize">{row.type}</span> },
    {
      key: "scheduledDate",
      header: "Due",
      render: (row) => (
        <div>
          {formatDate(row.scheduledDate)}
          <DueInfo row={row} />
        </div>
      ),
    },
    // For a scheduled job this is alertStatus (overdue/upcoming/scheduled),
    // which factors in running hours as well as the date — not just the raw
    // stored status. Completed/cancelled jobs show their real status as-is.
    { key: "status", header: "Status", render: (row) => <Badge status={row.status === "scheduled" ? row.alertStatus : row.status} /> },
    { key: "vendor", header: "Vendor", render: (row) => row.vendor || "—" },
    { key: "cost", header: "Cost", render: (row) => formatNumber(row.cost) },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" icon={Eye} aria-label={`View ${row.description}`} onClick={() => onView(row)} />
          {onComplete && row.status === "scheduled" && (
            <Button variant="ghost" size="sm" icon={CheckCircle2} aria-label={`Complete ${row.description}`} onClick={() => onComplete(row)} />
          )}
          {onEdit && row.status === "scheduled" && (
            <Button variant="ghost" size="sm" icon={Pencil} aria-label={`Edit ${row.description}`} onClick={() => onEdit(row)} />
          )}
          {onCancel && row.status === "scheduled" && (
            <Button variant="ghost" size="sm" icon={Ban} aria-label={`Cancel ${row.description}`} onClick={() => onCancel(row)} />
          )}
          <Button variant="ghost" size="sm" icon={Paperclip} aria-label={`Invoice for ${row.description}`} onClick={() => onInvoice(row)} />
          {onDelete && <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Delete ${row.description}`} onClick={() => onDelete(row)} />}
        </div>
      ),
    },
  ];
}

export default function GeneratorMaintenancePage() {
  // Maintenance has no permissions of its own yet — it still rides on the
  // same generator.* permissions the backend checks on these routes.
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("generator.create");
  const canUpdate = hasPermission("generator.update");
  const canDelete = hasPermission("generator.delete");

  const [generatorOptions, setGeneratorOptions] = useState([]);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [generatorId, setGeneratorId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [viewingJob, setViewingJob] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  const [completeTarget, setCompleteTarget] = useState(null);

  const [invoiceTarget, setInvoiceTarget] = useState(null);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelError, setCancelError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // The list endpoint only returns totals for the current page/filter, so the
  // two alert counts come from the dedicated alerts feed instead — the same
  // approach GeneratorPage uses for its own stat cards.
  const [alertCounts, setAlertCounts] = useState(null);

  useEffect(() => {
    generatorService
      .listGenerators({ pageSize: 200 })
      .then(({ items }) => setGeneratorOptions(items.map((g) => ({ value: g._id, label: g.tag }))))
      .catch(() => {
        // The filter dropdown just stays empty (only "All generators"); the
        // table load below has its own error handling.
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { items, meta } = await generatorService.listMaintenance({
        page,
        pageSize: PAGE_SIZE,
        ...(generatorId ? { generatorId } : {}),
        ...(status ? { status } : {}),
      });
      setItems(items);
      setMeta(meta);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, generatorId, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    generatorService
      .getMaintenanceAlerts()
      .then(({ counts }) => {
        if (!cancelled) setAlertCounts(counts);
      })
      .catch(() => {
        // Stat cards are a nice-to-have; a failure here shouldn't block the list.
      });
    return () => {
      cancelled = true;
    };
  }, [items]);

  const handleGeneratorChange = (value) => {
    setGeneratorId(value);
    setPage(1);
  };
  const handleStatusChange = (value) => {
    setStatus(value);
    setPage(1);
  };
  const handleReset = () => {
    setGeneratorId("");
    setStatus("");
    setPage(1);
  };

  const openScheduleForm = () => {
    setEditingJob(null);
    setFormOpen(true);
  };
  const openEditForm = (job) => {
    setEditingJob(job);
    setFormOpen(true);
  };
  const handleSaved = () => {
    setFormOpen(false);
    setEditingJob(null);
    load();
  };

  const handleCompleted = () => {
    setCompleteTarget(null);
    load();
  };

  // Keeps the row's own invoice field in sync without a full reload, in case
  // it's reopened before the list next refreshes.
  const handleInvoiceChanged = (updatedJob) => {
    setItems((current) => current.map((j) => (j._id === updatedJob._id ? { ...j, invoice: updatedJob.invoice } : j)));
  };

  const closeCancelDialog = () => {
    setCancelTarget(null);
    setCancelError(null);
  };

  const handleCancelConfirm = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await generatorService.updateMaintenance(cancelTarget._id, { status: "cancelled" });
      setCancelTarget(null);
      load();
    } catch (err) {
      setCancelError(extractErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await generatorService.deleteMaintenance(deleteTarget._id);
      setDeleteTarget(null);
      // Deleting the only row on a later page would leave that page empty; step back one page instead.
      if (items.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const openInvoiceFromDetails = (job) => {
    setViewingJob(null);
    setInvoiceTarget(job);
  };

  const columns = buildColumns({
    onView: (row) => setViewingJob(row),
    onEdit: canUpdate ? openEditForm : undefined,
    onComplete: canUpdate ? (row) => setCompleteTarget(row) : undefined,
    onCancel: canUpdate ? (row) => setCancelTarget(row) : undefined,
    onInvoice: (row) => setInvoiceTarget(row),
    onDelete: canDelete ? (row) => setDeleteTarget(row) : undefined,
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Overdue"
          value={alertCounts ? alertCounts.overdue : "—"}
          icon={AlertTriangle}
          iconColor="text-status-error"
          iconBg="bg-red-50"
        />
        <StatCard
          label="Upcoming"
          value={alertCounts ? alertCounts.upcoming : "—"}
          icon={Clock3}
          iconColor="text-status-warning"
          iconBg="bg-amber-50"
        />
      </div>

      <FilterBar
        filters={
          <>
            <Select value={generatorId} onChange={(e) => handleGeneratorChange(e.target.value)} options={generatorOptions} placeholder="All generators" />
            <Select value={status} onChange={(e) => handleStatusChange(e.target.value)} options={STATUS_OPTIONS} placeholder="All statuses" />
          </>
        }
        onReset={generatorId || status ? handleReset : undefined}
        actions={
          canCreate ? (
            <Button icon={Plus} onClick={openScheduleForm}>
              Schedule Maintenance
            </Button>
          ) : undefined
        }
      />

      <Table
        columns={columns}
        data={items}
        loading={loading}
        error={error}
        onRetry={load}
        keyField="_id"
        emptyTitle="No maintenance records found"
        emptyDescription="No maintenance jobs match your filters, or none have been scheduled yet."
        pagination={{
          page: meta.page,
          totalPages: meta.totalPages,
          totalItems: meta.totalItems,
          pageSize: meta.pageSize,
          onPageChange: setPage,
        }}
      />

      <GeneratorMaintenanceDetails
        open={Boolean(viewingJob)}
        job={viewingJob}
        onClose={() => setViewingJob(null)}
        onManageInvoice={openInvoiceFromDetails}
      />

      <GeneratorMaintenanceForm
        open={formOpen}
        job={editingJob}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        generatorOptions={generatorOptions}
        defaultGeneratorId={generatorId}
      />

      <GeneratorMaintenanceCompleteForm
        open={Boolean(completeTarget)}
        job={completeTarget}
        onClose={() => setCompleteTarget(null)}
        onSaved={handleCompleted}
      />

      <GeneratorMaintenanceInvoice
        open={Boolean(invoiceTarget)}
        job={invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
        onChanged={handleInvoiceChanged}
        canUpdate={canUpdate}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={closeCancelDialog}
        onConfirm={handleCancelConfirm}
        loading={cancelling}
        variant="danger"
        confirmLabel="Cancel Job"
        cancelLabel="Back"
        title="Cancel this maintenance job?"
        description={
          cancelError ||
          `"${cancelTarget?.description ?? "This job"}" is kept as history, marked cancelled, but a recurring job's next occurrence is not created. This cannot be undone.`
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Delete maintenance record?"
        description={
          deleteError ||
          `This permanently deletes "${deleteTarget?.description ?? "this record"}". To keep it as history without doing it, cancel it instead. This cannot be undone.`
        }
      />
    </div>
  );
}

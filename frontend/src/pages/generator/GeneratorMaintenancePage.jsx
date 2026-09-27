import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/modals/ConfirmDialog";
import Table from "../../components/tables/Table";
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

// `onDelete` is left undefined for a user without generator.delete, and then
// that button is not drawn at all — the same pattern GeneratorPage uses.
function buildColumns({ onDelete }) {
  return [
    { key: "generator", header: "Generator", render: (row) => <span className="font-medium text-ink">{row.generator?.tag ?? "—"}</span> },
    { key: "description", header: "Description" },
    { key: "type", header: "Type", render: (row) => <span className="capitalize">{row.type}</span> },
    { key: "scheduledDate", header: "Scheduled Date", render: (row) => formatDate(row.scheduledDate) },
    // Shows the real stored status for now; a scheduled job's overdue/upcoming
    // alert status is surfaced in 2.9.5, once it also needs a "due in" column.
    { key: "status", header: "Status", render: (row) => <Badge status={row.status} /> },
    { key: "vendor", header: "Vendor", render: (row) => row.vendor || "—" },
    { key: "cost", header: "Cost", render: (row) => formatNumber(row.cost) },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
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
  const canDelete = hasPermission("generator.delete");

  const [generatorOptions, setGeneratorOptions] = useState([]);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [generatorId, setGeneratorId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  const columns = buildColumns({
    onDelete: canDelete ? (row) => setDeleteTarget(row) : undefined,
  });

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        filters={
          <>
            <Select value={generatorId} onChange={(e) => handleGeneratorChange(e.target.value)} options={generatorOptions} placeholder="All generators" />
            <Select value={status} onChange={(e) => handleStatusChange(e.target.value)} options={STATUS_OPTIONS} placeholder="All statuses" />
          </>
        }
        onReset={generatorId || status ? handleReset : undefined}
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

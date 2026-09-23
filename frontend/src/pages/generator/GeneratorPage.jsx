import { useCallback, useEffect, useState } from "react";
import { Zap, Wrench, AlertTriangle, Plus, Eye, Pencil, Trash2 } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/modals/ConfirmDialog";
import Table from "../../components/tables/Table";
import GeneratorForm, { extractErrorMessage } from "./GeneratorForm";
import GeneratorDetails from "./GeneratorDetails";
import { generatorService } from "../../services/generatorService";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "operational", label: "Operational" },
  { value: "under_maintenance", label: "Under Maintenance" },
  { value: "faulty", label: "Faulty" },
  { value: "decommissioned", label: "Decommissioned" },
];

function buildColumns({ onView, onEdit, onDelete }) {
  return [
    { key: "tag", header: "Tag", render: (row) => <span className="font-medium text-ink">{row.tag}</span> },
    { key: "name", header: "Name" },
    { key: "location", header: "Location", render: (row) => row.location || "—" },
    { key: "status", header: "Status", render: (row) => <Badge status={row.status} /> },
    {
      key: "runningHoursTotal",
      header: "Running Hours",
      render: (row) => row.runningHoursTotal.toFixed(1),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" icon={Eye} aria-label={`View ${row.tag}`} onClick={() => onView(row)} />
          <Button variant="ghost" size="sm" icon={Pencil} aria-label={`Edit ${row.tag}`} onClick={() => onEdit(row)} />
          <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Delete ${row.tag}`} onClick={() => onDelete(row)} />
        </div>
      ),
    },
  ];
}

export default function GeneratorPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingGenerator, setEditingGenerator] = useState(null);
  const [viewingGenerator, setViewingGenerator] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // The list endpoint only returns totals for the current filter, so the
  // three status counts are three cheap, parallel pageSize:1 requests read
  // for their meta.totalItems — there's no dedicated stats endpoint.
  const [stats, setStats] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { items, meta } = await generatorService.listGenerators({
        page,
        pageSize: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      });
      setItems(items);
      setMeta(meta);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [operational, underMaintenance, faulty] = await Promise.all([
          generatorService.listGenerators({ status: "operational", pageSize: 1 }),
          generatorService.listGenerators({ status: "under_maintenance", pageSize: 1 }),
          generatorService.listGenerators({ status: "faulty", pageSize: 1 }),
        ]);
        if (!cancelled) {
          setStats({
            operational: operational.meta.totalItems,
            underMaintenance: underMaintenance.meta.totalItems,
            faulty: faulty.meta.totalItems,
          });
        }
      } catch {
        // Stat cards are a nice-to-have; a failure here shouldn't block the list.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };
  const handleStatusChange = (value) => {
    setStatus(value);
    setPage(1);
  };
  const handleReset = () => {
    setSearch("");
    setStatus("");
    setPage(1);
  };

  const openCreateForm = () => {
    setEditingGenerator(null);
    setFormOpen(true);
  };
  const openEditForm = (generator) => {
    setEditingGenerator(generator);
    setFormOpen(true);
  };
  const handleSaved = () => {
    setFormOpen(false);
    setEditingGenerator(null);
    load();
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await generatorService.deleteGenerator(deleteTarget._id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const columns = buildColumns({
    onView: (row) => setViewingGenerator(row),
    onEdit: openEditForm,
    onDelete: (row) => setDeleteTarget(row),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Generator Management" description="Track the organization's backup generators." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Operational"
          value={stats ? stats.operational : "—"}
          icon={Zap}
          iconColor="text-status-success"
          iconBg="bg-green-50"
        />
        <StatCard
          label="Under Maintenance"
          value={stats ? stats.underMaintenance : "—"}
          icon={Wrench}
          iconColor="text-status-warning"
          iconBg="bg-amber-50"
        />
        <StatCard
          label="Faulty"
          value={stats ? stats.faulty : "—"}
          icon={AlertTriangle}
          iconColor="text-status-error"
          iconBg="bg-red-50"
        />
      </div>

      <FilterBar
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search by tag or name..."
        filters={
          <Select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
          />
        }
        onReset={search || status ? handleReset : undefined}
        actions={
          <Button icon={Plus} onClick={openCreateForm}>
            Add Generator
          </Button>
        }
      />

      <Table
        columns={columns}
        data={items}
        loading={loading}
        error={error}
        onRetry={load}
        keyField="_id"
        emptyTitle="No generators found"
        emptyDescription="No generators match your filters, or none have been added yet."
        pagination={{
          page: meta.page,
          totalPages: meta.totalPages,
          totalItems: meta.totalItems,
          pageSize: meta.pageSize,
          onPageChange: setPage,
        }}
      />

      <GeneratorDetails
        open={Boolean(viewingGenerator)}
        onClose={() => setViewingGenerator(null)}
        generator={viewingGenerator}
      />

      <GeneratorForm
        open={formOpen}
        generator={editingGenerator}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Delete generator?"
        description={
          deleteError ||
          `This will remove ${deleteTarget?.tag ?? "this generator"} from the registry. Its logs and maintenance history are kept.`
        }
      />
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Plus, Gift, AlertTriangle, Wallet, PackageCheck, MoreVertical, Eye, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, Send } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { CardSkeleton } from "../../components/common/Loading";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Table from "../../components/tables/Table";
import Modal from "../../components/modals/Modal";
import ConfirmDialog from "../../components/modals/ConfirmDialog";
import GiveawayItemForm from "../../components/forms/GiveawayItemForm";
import GiveawayIssueForm from "../../components/forms/GiveawayIssueForm";
import StockAdjustForm from "../../components/forms/StockAdjustForm";
import { giveawayService } from "../../services/giveawayService";
import { giveawayCategoryOptions } from "../../constants/giveawayOptions";
import { useAuth } from "../../context/AuthContext";

const statusFilterOptions = [
  { value: "lowStock", label: "Low Stock" },
  { value: "outOfStock", label: "Out of Stock" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const PAGE_SIZE = 10;

export default function GiveawaysPage() {
  const { hasPermission } = useAuth();

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [formModal, setFormModal] = useState(null); // null | { mode: "add" | "edit", item?, readOnly? }
  const [issueModalItem, setIssueModalItem] = useState(null);
  const [stockModal, setStockModal] = useState(null); // { item, mode: "stock-in" | "stock-out" }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await giveawayService.dashboard();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { items, meta } = await giveawayService.listItems({
        search: search || undefined,
        category: category || undefined,
        status: status || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItems(items);
      setMeta(meta);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search, category, status, page]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    setPage(1);
  }, [search, category, status]);

  const refreshAll = () => {
    loadItems();
    loadSummary();
  };

  const handleFormSubmit = async (payload) => {
    setSubmitting(true);
    try {
      if (formModal.mode === "edit") {
        await giveawayService.updateItem(formModal.item._id, payload);
      } else {
        await giveawayService.createItem(payload);
      }
      setFormModal(null);
      refreshAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await giveawayService.deactivateItem(deleteTarget._id);
      setDeleteTarget(null);
      refreshAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueSubmit = async (payload) => {
    setSubmitting(true);
    try {
      await giveawayService.issueItem(payload);
      setIssueModalItem(null);
      refreshAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStockSubmit = async (payload) => {
    setSubmitting(true);
    try {
      if (stockModal.mode === "stock-in") {
        await giveawayService.stockIn(stockModal.item._id, payload);
      } else {
        await giveawayService.stockOut(stockModal.item._id, payload);
      }
      setStockModal(null);
      refreshAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const canCreate = hasPermission("giveaways.create");
  const canUpdate = hasPermission("giveaways.update");
  const canDelete = hasPermission("giveaways.delete");
  const canIssue = hasPermission("giveaways.issue");

  const columns = [
    { key: "itemName", header: "Item Name", render: (row) => <span className="font-medium text-ink">{row.itemName}</span> },
    { key: "sku", header: "SKU" },
    { key: "category", header: "Category" },
    { key: "unitPrice", header: "Unit Price", render: (row) => `$${row.unitPrice.toFixed(2)}` },
    { key: "vendor", header: "Vendor", render: (row) => row.vendor || "—" },
    { key: "currentStock", header: "Current Stock" },
    { key: "minimumStock", header: "Min. Stock" },
    { key: "status", header: "Status", render: (row) => <Badge status={row.status} /> },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="relative">
          <button
            onClick={() => setOpenMenuId(openMenuId === row._id ? null : row._id)}
            className="h-8 w-8 rounded-md flex items-center justify-center text-ink-muted hover:bg-surface-subtle"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {openMenuId === row._id && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
              <div className="absolute right-0 mt-1 w-44 bg-white border border-border rounded-md shadow-elevated z-20 py-1.5">
                <MenuItem
                  icon={Eye}
                  label="View"
                  onClick={() => {
                    setFormModal({ mode: "edit", item: row, readOnly: true });
                    setOpenMenuId(null);
                  }}
                />
                {canUpdate && (
                  <>
                    <MenuItem
                      icon={Pencil}
                      label="Edit"
                      onClick={() => {
                        setFormModal({ mode: "edit", item: row });
                        setOpenMenuId(null);
                      }}
                    />
                    <MenuItem
                      icon={ArrowDownCircle}
                      label="Stock In"
                      onClick={() => {
                        setStockModal({ item: row, mode: "stock-in" });
                        setOpenMenuId(null);
                      }}
                    />
                    <MenuItem
                      icon={ArrowUpCircle}
                      label="Stock Out"
                      onClick={() => {
                        setStockModal({ item: row, mode: "stock-out" });
                        setOpenMenuId(null);
                      }}
                    />
                  </>
                )}
                {canIssue && (
                  <MenuItem
                    icon={Send}
                    label="Issue"
                    onClick={() => {
                      setIssueModalItem(row);
                      setOpenMenuId(null);
                    }}
                  />
                )}
                {canDelete && (
                  <MenuItem
                    icon={Trash2}
                    label="Delete"
                    danger
                    onClick={() => {
                      setDeleteTarget(row);
                      setOpenMenuId(null);
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Giveaways Inventory"
        description="Manage giveaway items, stock levels, and distribution."
        action={
          canCreate && (
            <Button icon={Plus} onClick={() => setFormModal({ mode: "add" })}>
              Add Item
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Total Items" value={summary?.totalItems ?? 0} icon={Gift} />
            <StatCard
              label="Inventory Value"
              value={`$${(summary?.totalInventoryValue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              icon={Wallet}
            />
            <StatCard
              label="Low Stock Items"
              value={summary?.lowStockCount ?? 0}
              icon={AlertTriangle}
              iconColor="text-status-warning"
              iconBg="bg-status-warningBg"
            />
            <StatCard label="Issued This Month" value={summary?.monthlyIssuedQuantity ?? 0} icon={PackageCheck} />
          </>
        )}
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or SKU..."
        filters={
          <>
            <Select
              options={giveawayCategoryOptions}
              placeholder="All Categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-44"
            />
            <Select
              options={statusFilterOptions}
              placeholder="All Statuses"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-40"
            />
          </>
        }
        onReset={() => {
          setSearch("");
          setCategory("");
          setStatus("");
        }}
      />

      <Table
        columns={columns}
        data={items}
        loading={loading}
        error={error}
        onRetry={loadItems}
        keyField="_id"
        emptyTitle="No giveaway items found"
        emptyDescription="Add your first giveaway item to start tracking inventory."
        emptyAction={canCreate ? { label: "Add Item", onClick: () => setFormModal({ mode: "add" }) } : undefined}
        pagination={{
          page: meta.page,
          totalPages: meta.totalPages,
          totalItems: meta.total,
          pageSize: PAGE_SIZE,
          onPageChange: setPage,
        }}
      />

      <Modal
        open={Boolean(formModal)}
        onClose={() => setFormModal(null)}
        title={formModal?.readOnly ? "Item Details" : formModal?.mode === "edit" ? "Edit Item" : "Add Giveaway Item"}
        size="md"
      >
        {formModal && (
          <GiveawayItemForm
            initialValues={formModal.item}
            onSubmit={handleFormSubmit}
            onCancel={() => setFormModal(null)}
            submitting={submitting}
          />
        )}
      </Modal>

      <Modal open={Boolean(issueModalItem)} onClose={() => setIssueModalItem(null)} title="Issue Giveaway" size="md">
        {issueModalItem && (
          <GiveawayIssueForm
            item={issueModalItem}
            onSubmit={handleIssueSubmit}
            onCancel={() => setIssueModalItem(null)}
            submitting={submitting}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(stockModal)}
        onClose={() => setStockModal(null)}
        title={stockModal?.mode === "stock-out" ? "Remove Stock" : "Add Stock"}
        size="sm"
      >
        {stockModal && (
          <StockAdjustForm
            item={stockModal.item}
            mode={stockModal.mode}
            onSubmit={handleStockSubmit}
            onCancel={() => setStockModal(null)}
            submitting={submitting}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Item?"
        description={`Are you sure you want to delete "${deleteTarget?.itemName}"? This will deactivate it and hide it from active inventory.`}
        loading={submitting}
      />
    </>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-body hover:bg-surface-subtle ${
        danger ? "text-status-error hover:bg-status-errorBg" : "text-ink-secondary"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Package,
  AlertTriangle,
  Wallet,
  ShoppingCart,
  Eye,
  Pencil,
  Trash2,
  ShoppingBag,
  MinusCircle,
} from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import ActionMenu from "../../components/common/ActionMenu";
import StatCard from "../../components/common/StatCard";
import { CardSkeleton } from "../../components/common/Loading";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Card from "../../components/common/Card";
import Table from "../../components/tables/Table";
import Modal from "../../components/modals/Modal";
import ConfirmDialog from "../../components/modals/ConfirmDialog";
import InventoryItemForm from "../../components/forms/InventoryItemForm";
import PurchaseForm from "../../components/forms/PurchaseForm";
import ConsumeForm from "../../components/forms/ConsumeForm";
import { inventoryService } from "../../services/inventoryService";
import { useAuth } from "../../context/AuthContext";

const statusFilterOptions = [
  { value: "lowStock", label: "Low Stock" },
  { value: "outOfStock", label: "Out of Stock" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const PAGE_SIZE = 10;

export default function InventoryPage() {
  const { hasPermission } = useAuth();

  const [activeType, setActiveType] = useState("grocery");
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);

  const [formModal, setFormModal] = useState(null);
  const [purchaseModalItem, setPurchaseModalItem] = useState(null);
  const [consumeModalItem, setConsumeModalItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await inventoryService.dashboard(activeType);
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [activeType]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { items, meta } = await inventoryService.listItems({
        type: activeType,
        search: search || undefined,
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
  }, [activeType, search, status, page]);

  const loadPurchases = useCallback(async () => {
    setPurchasesLoading(true);
    try {
      const { purchases } = await inventoryService.listPurchases({ limit: 5 });
      setPurchases(purchases);
    } catch {
      setPurchases([]);
    } finally {
      setPurchasesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  useEffect(() => {
    setPage(1);
  }, [activeType, search, status]);

  const refreshAll = () => {
    loadItems();
    loadSummary();
    loadPurchases();
  };

  const handleFormSubmit = async (payload) => {
    setSubmitting(true);
    try {
      if (formModal.mode === "edit") {
        await inventoryService.updateItem(formModal.item._id, payload);
      } else {
        await inventoryService.createItem(payload);
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
      await inventoryService.deactivateItem(deleteTarget._id);
      setDeleteTarget(null);
      refreshAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePurchaseSubmit = async (payload) => {
    setSubmitting(true);
    try {
      await inventoryService.recordPurchase(payload);
      setPurchaseModalItem(null);
      refreshAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsumeSubmit = async (payload) => {
    setSubmitting(true);
    try {
      await inventoryService.consume(consumeModalItem._id, payload);
      setConsumeModalItem(null);
      refreshAll();
    } catch (err) {
      alert(err?.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const canCreate = hasPermission("inventory.create");
  const canUpdate = hasPermission("inventory.update");
  const canDelete = hasPermission("inventory.delete");
  const canPurchase = hasPermission("inventory.purchase");

  const columns = [
    { key: "itemName", header: "Item Name", render: (row) => <span className="font-medium text-ink">{row.itemName}</span> },
    { key: "unit", header: "Unit" },
    { key: "vendor", header: "Vendor", render: (row) => row.vendor || "—" },
    { key: "unitCost", header: "Unit Cost", render: (row) => `$${row.unitCost.toFixed(2)}` },
    { key: "currentStock", header: "Current Balance" },
    { key: "minimumStock", header: "Min. Stock" },
    { key: "status", header: "Status", render: (row) => <Badge status={row.status} /> },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        const menuItems = [
          { icon: Eye, label: "View", onClick: () => setFormModal({ mode: "edit", item: row, readOnly: true }) },
        ];
        if (canUpdate) {
          menuItems.push({ icon: Pencil, label: "Edit", onClick: () => setFormModal({ mode: "edit", item: row }) });
        }
        if (canPurchase) {
          menuItems.push({
            icon: ShoppingBag,
            label: "Record Purchase",
            onClick: () => setPurchaseModalItem(row),
          });
        }
        if (canUpdate) {
          menuItems.push({ icon: MinusCircle, label: "Consume", onClick: () => setConsumeModalItem(row) });
        }
        if (canDelete) {
          menuItems.push({ icon: Trash2, label: "Delete", danger: true, onClick: () => setDeleteTarget(row) });
        }
        return <ActionMenu items={menuItems} />;
      },
    },
  ];

  const purchaseColumns = [
    { key: "item", header: "Item", render: (row) => row.item?.itemName || "—" },
    { key: "purchaseDate", header: "Date", render: (row) => new Date(row.purchaseDate).toLocaleDateString() },
    { key: "vendor", header: "Vendor" },
    { key: "invoiceNumber", header: "Invoice #", render: (row) => row.invoiceNumber || "—" },
    { key: "purchaseAmount", header: "Amount", render: (row) => `$${row.purchaseAmount.toFixed(2)}` },
    {
      key: "paymentStatus",
      header: "Payment",
      render: (row) => <Badge status={row.paymentStatus.toLowerCase()} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Grocery & Cleaning Inventory"
        description="Track grocery and cleaning supplies, purchases, and consumption."
        action={
          canCreate && (
            <Button icon={Plus} onClick={() => setFormModal({ mode: "add" })}>
              Add Item
            </Button>
          )
        }
      />

      {/* Type tabs */}
      <div className="inline-flex bg-surface-blue rounded-md p-1 w-fit">
        {["grocery", "cleaning"].map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`px-4 h-8 rounded-md text-body font-medium capitalize transition-colors duration-150 ${
              activeType === t ? "bg-white text-primary shadow-card" : "text-ink-secondary hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Total Items" value={summary?.totalItems ?? 0} icon={Package} />
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
            <StatCard
              label="Monthly Purchases"
              value={`$${(summary?.monthlyPurchaseAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              icon={ShoppingCart}
            />
          </>
        )}
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search items..."
        filters={
          <Select
            options={statusFilterOptions}
            placeholder="All Statuses"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-40"
          />
        }
        onReset={() => {
          setSearch("");
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
        emptyTitle={`No ${activeType} items found`}
        emptyDescription="Add an item to start tracking inventory."
        emptyAction={canCreate ? { label: "Add Item", onClick: () => setFormModal({ mode: "add" }) } : undefined}
        pagination={{
          page: meta.page,
          totalPages: meta.totalPages,
          totalItems: meta.total,
          pageSize: PAGE_SIZE,
          onPageChange: setPage,
        }}
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-section-heading text-ink">Recent Purchases</h2>
        <Card padding={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            {purchasesLoading ? (
              <div className="p-6">
                <CardSkeleton />
              </div>
            ) : purchases.length === 0 ? (
              <p className="text-body text-ink-muted text-center py-8">No purchases recorded yet.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-subtle border-b border-border">
                    {purchaseColumns.map((col) => (
                      <th key={col.key} className="px-4 py-3 text-helper font-semibold text-ink-secondary uppercase tracking-wide whitespace-nowrap">
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((row) => (
                    <tr key={row._id} className="border-b border-border last:border-0">
                      {purchaseColumns.map((col) => (
                        <td key={col.key} className="px-4 py-3.5 text-body text-ink whitespace-nowrap">
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={Boolean(formModal)}
        onClose={() => setFormModal(null)}
        title={formModal?.readOnly ? "Item Details" : formModal?.mode === "edit" ? "Edit Item" : "Add Inventory Item"}
        size="md"
      >
        {formModal && (
          <InventoryItemForm
            initialValues={formModal.item}
            defaultType={activeType}
            onSubmit={handleFormSubmit}
            onCancel={() => setFormModal(null)}
            submitting={submitting}
          />
        )}
      </Modal>

      <Modal open={Boolean(purchaseModalItem)} onClose={() => setPurchaseModalItem(null)} title="Record Purchase" size="md">
        {purchaseModalItem && (
          <PurchaseForm
            item={purchaseModalItem}
            onSubmit={handlePurchaseSubmit}
            onCancel={() => setPurchaseModalItem(null)}
            submitting={submitting}
          />
        )}
      </Modal>

      <Modal open={Boolean(consumeModalItem)} onClose={() => setConsumeModalItem(null)} title="Record Consumption" size="sm">
        {consumeModalItem && (
          <ConsumeForm
            item={consumeModalItem}
            onSubmit={handleConsumeSubmit}
            onCancel={() => setConsumeModalItem(null)}
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


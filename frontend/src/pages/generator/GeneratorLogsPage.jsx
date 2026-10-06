import { Fragment, useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import clsx from "clsx";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import DatePicker from "../../components/common/DatePicker";
import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/modals/ConfirmDialog";
import Table from "../../components/tables/Table";
import GeneratorLogForm from "./GeneratorLogForm";
import { extractErrorMessage } from "./GeneratorForm";
import { useAuth } from "../../context/AuthContext";
import { generatorService } from "../../services/generatorService";
import { formatDate, formatDateNumeric } from "../../utils/formatDate";
import { formatNumber } from "../../utils/formatNumber";
import { fuelUnit } from "../../utils/fuelUnit";
import { gaugeMarkSymbol } from "../../utils/fuelFigures";
import { formatHoursMinutes } from "../../utils/hoursMinutes";

const PAGE_SIZE = 10;

// Small "label  value" pairs stacked in a cell, so a number always says what
// it is. `lines` is [label, value, colourClass?] or a falsy entry to skip;
// with nothing to show the cell reads "—".
function LabelledLines({ lines }) {
  const shown = lines.filter(Boolean);
  if (!shown.length) return "—";
  return (
    <dl className="m-0 grid grid-cols-[auto_auto] justify-start gap-x-3 gap-y-0.5">
      {shown.map(([label, value, tone]) => (
        <Fragment key={label}>
          <dt className="text-helper text-ink-muted">{label}</dt>
          <dd className={clsx("m-0 font-medium tabular-nums", tone)}>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

// Populates the generator filter dropdown. There's no dedicated "list all
// generators, lightly" endpoint, so this reuses listGenerators with a large
// pageSize — the same assumption GeneratorPage's stat cards make: fine
// while the fleet stays in the dozens, worth a real endpoint if it grows
// into the hundreds.
const GENERATOR_OPTIONS_PAGE_SIZE = 200;

const COLUMNS = [
  {
    key: "generator",
    header: "Generator",
    render: (row) => <span className="font-medium text-ink">{row.generator?.tag ?? "—"}</span>,
  },
  { key: "date", header: "Date", render: (row) => formatDateNumeric(row.date) },
  { key: "hoursRun", header: "Hours Run", render: (row) => formatHoursMinutes(row.hoursRun) },
  {
    key: "fuel",
    header: "Fuel Movement",
    render: (row) => {
      const unit = fuelUnit(row.generator?.fuelType);
      const hasBothReadings = row.openingFuelLiters != null && row.closingFuelLiters != null;
      return (
        <LabelledLines
          lines={[
            row.fuelAddedLiters > 0 && ["Added", `+${formatNumber(row.fuelAddedLiters)} ${unit}`, "text-green-700"],
            (row.fuelConsumedLiters > 0 || hasBothReadings) && ["Used", `${formatNumber(row.fuelConsumedLiters)} ${unit}`, "text-amber-700"],
          ]}
        />
      );
    },
  },
  {
    key: "tank",
    header: "Tank Level",
    render: (row) => {
      const unit = fuelUnit(row.generator?.fuelType);
      // A reading taken off a needle gauge shows the mark it was read at
      // (e.g. "≈ 100 L (½)") alongside the amount converted from it; a
      // precise digital/typed reading just shows the amount.
      const tankValue = (amount, mark) => {
        const symbol = gaugeMarkSymbol(mark);
        return symbol ? `≈ ${formatNumber(amount)} ${unit} (${symbol})` : `${formatNumber(amount)} ${unit}`;
      };
      return (
        <LabelledLines
          lines={[
            row.openingFuelLiters != null && ["Opening", tankValue(row.openingFuelLiters, row.openingFuelGaugeReading)],
            row.closingFuelLiters != null && ["Closing", tankValue(row.closingFuelLiters, row.fuelGaugeReading)],
          ]}
        />
      );
    },
  },
  { key: "cost", header: "Fuel Cost", render: (row) => formatNumber(row.fuelCostTotal) },
  { key: "vendor", header: "Vendor", render: (row) => row.fuelVendor || "—" },
  { key: "reason", header: "Reason", render: (row) => row.reason || "—" },
  { key: "recordedBy", header: "Recorded By", render: (row) => row.recordedBy?.name ?? "—" },
];

export default function GeneratorLogsPage() {
  // Same permissions the backend enforces on the log routes (POST, PATCH and
  // DELETE /generator/logs). Day-to-day users can add logs; correcting or
  // deleting one is for managers and admins. The buttons are hidden rather
  // than shown and refused.
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("generator_log.create");
  const canUpdate = hasPermission("generator_log.update");
  const canDelete = hasPermission("generator_log.delete");

  const [generatorOptions, setGeneratorOptions] = useState([]);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [generatorId, setGeneratorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    generatorService
      .listGenerators({ pageSize: GENERATOR_OPTIONS_PAGE_SIZE })
      .then(({ items }) =>
        setGeneratorOptions(
          items.map((g) => ({
            value: g._id,
            label: g.tag,
            fuelType: g.fuelType,
            fuelMeasurementType: g.fuelMeasurementType,
            fuelTankCapacityLiters: g.fuelTankCapacityLiters,
          }))
        )
      )
      .catch(() => {
        // The filter dropdown just stays empty (only "All generators"); the
        // table load below has its own error handling.
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { items, meta } = await generatorService.listLogs({
        page,
        pageSize: PAGE_SIZE,
        ...(generatorId ? { generatorId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      setItems(items);
      setMeta(meta);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, generatorId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGeneratorChange = (value) => {
    setGeneratorId(value);
    setPage(1);
  };
  const handleFromChange = (value) => {
    setFrom(value);
    setPage(1);
  };
  const handleToChange = (value) => {
    setTo(value);
    setPage(1);
  };
  const handleReset = () => {
    setGeneratorId("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const openAddForm = () => {
    setEditingLog(null);
    setFormOpen(true);
  };
  const openEditForm = (row) => {
    setEditingLog(row);
    setFormOpen(true);
  };
  const handleLogSaved = () => {
    setFormOpen(false);
    setEditingLog(null);
    load();
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await generatorService.deleteLog(deleteTarget._id);
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

  const columns = canUpdate || canDelete
    ? [
        ...COLUMNS,
        {
          key: "actions",
          header: "",
          render: (row) => (
            <div className="flex items-center justify-end gap-1">
              {canUpdate && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Pencil}
                  aria-label={`Edit ${row.generator?.tag ?? "generator"} log from ${formatDate(row.date)}`}
                  onClick={() => openEditForm(row)}
                />
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  aria-label={`Delete ${row.generator?.tag ?? "generator"} log from ${formatDate(row.date)}`}
                  onClick={() => setDeleteTarget(row)}
                />
              )}
            </div>
          ),
        },
      ]
    : COLUMNS;

  const deleteHours = Number(deleteTarget?.hoursRun) || 0;
  const deleteDescription = deleteTarget
    ? `This removes the ${deleteTarget.generator?.tag ?? "generator"} entry from ${formatDate(deleteTarget.date)}` +
      `${deleteHours > 0 ? ` and takes its ${formatHoursMinutes(deleteHours)} off the generator's running hours` : ""}. ` +
      "Entries recorded after it are not recalculated."
    : "";

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        filters={
          <>
            <Select
              value={generatorId}
              onChange={(e) => handleGeneratorChange(e.target.value)}
              options={generatorOptions}
              placeholder="All generators"
            />
            <DatePicker label="From" id="logs-filter-from" className="sm:w-40" clearable value={from} max={to || undefined} onChange={handleFromChange} />
            <DatePicker label="To" id="logs-filter-to" className="sm:w-40" clearable value={to} min={from || undefined} onChange={handleToChange} />
          </>
        }
        onReset={generatorId || from || to ? handleReset : undefined}
        actions={
          canCreate ? (
            <Button icon={Plus} onClick={openAddForm}>
              Add Log
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
        emptyTitle="No logs found"
        emptyDescription="No usage logs match your filters, or none have been recorded yet."
        pagination={{
          page: meta.page,
          totalPages: meta.totalPages,
          totalItems: meta.totalItems,
          pageSize: meta.pageSize,
          onPageChange: setPage,
        }}
      />

      <GeneratorLogForm
        open={formOpen}
        log={editingLog}
        onClose={() => setFormOpen(false)}
        onSaved={handleLogSaved}
        generatorOptions={generatorOptions}
        defaultGeneratorId={generatorId}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Delete log entry?"
        description={deleteError || deleteDescription}
      />
    </div>
  );
}

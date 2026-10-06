import { useCallback, useEffect, useState } from "react";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import DatePicker from "../../components/common/DatePicker";
import Badge from "../../components/common/Badge";
import Table from "../../components/tables/Table";
import { generatorService } from "../../services/generatorService";
import { formatDate } from "../../utils/formatDate";
import { formatNumber } from "../../utils/formatNumber";
import { describeError } from "../../utils/errorMessage";

const PAGE_SIZE = 10;

// "History" defaults to jobs that are actually done with (completed or
// cancelled) on the backend when no status is given — "Scheduled" is
// included here as an explicit filter choice, for a job someone still wants
// to look up while it's open, but it's not part of the "all" default.
const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const COLUMNS = [
  { key: "generator", header: "Generator", render: (row) => <span className="font-medium text-ink">{row.generator?.tag ?? "—"}</span> },
  { key: "description", header: "Description" },
  { key: "type", header: "Type", render: (row) => <span className="capitalize">{row.type}</span> },
  { key: "scheduledDate", header: "Scheduled", render: (row) => formatDate(row.scheduledDate) },
  { key: "completedDate", header: "Completed", render: (row) => formatDate(row.completedDate) },
  { key: "status", header: "Status", render: (row) => <Badge status={row.status} /> },
  { key: "vendor", header: "Vendor", render: (row) => row.vendor || "—" },
  { key: "cost", header: "Cost", render: (row) => formatNumber(row.cost) },
];

/**
 * Spec 4.2's "maintenance service history" report — a paginated, filterable
 * list of past maintenance jobs, same shape/pagination as the other list
 * endpoints. Defaults to "this month so far" like the other range reports.
 */
export default function GeneratorReportServiceHistory({ generatorOptions }) {
  const [generatorId, setGeneratorId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items, meta } = await generatorService.getServiceHistoryReport({
        page,
        pageSize: PAGE_SIZE,
        ...(generatorId ? { generatorId } : {}),
        ...(status ? { status } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      setItems(items);
      setMeta(meta);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [generatorId, status, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setPage(1);
  };
  const handleReset = () => {
    setGeneratorId("");
    setStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        filters={
          <>
            <Select
              value={generatorId}
              onChange={(e) => handleFilterChange(setGeneratorId)(e.target.value)}
              options={generatorOptions}
              placeholder="All generators"
            />
            <Select
              value={status}
              onChange={(e) => handleFilterChange(setStatus)(e.target.value)}
              options={STATUS_OPTIONS}
              placeholder="Completed & cancelled"
            />
            <DatePicker label="From" id="service-history-filter-from" className="sm:w-40" clearable value={from} max={to || undefined} onChange={handleFilterChange(setFrom)} />
            <DatePicker label="To" id="service-history-filter-to" className="sm:w-40" clearable value={to} min={from || undefined} onChange={handleFilterChange(setTo)} />
          </>
        }
        onReset={generatorId || status || from || to ? handleReset : undefined}
      />

      <Table
        columns={COLUMNS}
        data={items}
        loading={loading}
        error={error}
        errorDescription={error ? describeError(error) : undefined}
        onRetry={load}
        keyField="_id"
        emptyTitle="No service history found"
        emptyDescription="No maintenance jobs match your filters."
        pagination={{
          page: meta.page,
          totalPages: meta.totalPages,
          totalItems: meta.totalItems,
          pageSize: meta.pageSize,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}

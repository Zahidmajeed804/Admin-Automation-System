import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import Input from "../../components/common/Input";
import Table from "../../components/tables/Table";
import { generatorService } from "../../services/generatorService";
import { formatDate } from "../../utils/formatDate";

const PAGE_SIZE = 10;

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
  { key: "date", header: "Date", render: (row) => formatDate(row.date) },
  { key: "hoursRun", header: "Hours Run", render: (row) => row.hoursRun },
  {
    key: "fuel",
    header: "Fuel",
    render: (row) => {
      const parts = [];
      if (row.fuelAddedLiters > 0) parts.push(`+${row.fuelAddedLiters} L`);
      if (row.fuelConsumedLiters > 0) parts.push(`-${row.fuelConsumedLiters} L`);
      return parts.length ? parts.join(" / ") : "—";
    },
  },
  { key: "reason", header: "Reason", render: (row) => row.reason || "—" },
  { key: "recordedBy", header: "Recorded By", render: (row) => row.recordedBy?.name ?? "—" },
];

export default function GeneratorLogsPage() {
  const [generatorOptions, setGeneratorOptions] = useState([]);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [generatorId, setGeneratorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    generatorService
      .listGenerators({ pageSize: GENERATOR_OPTIONS_PAGE_SIZE })
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Fuel & Usage Logs" description="Runtime and refueling history across every generator." />

      <FilterBar
        filters={
          <>
            <Select
              value={generatorId}
              onChange={(e) => handleGeneratorChange(e.target.value)}
              options={generatorOptions}
              placeholder="All generators"
            />
            <Input type="date" aria-label="From date" value={from} onChange={(e) => handleFromChange(e.target.value)} />
            <Input type="date" aria-label="To date" value={to} onChange={(e) => handleToChange(e.target.value)} />
          </>
        }
        onReset={generatorId || from || to ? handleReset : undefined}
      />

      <Table
        columns={COLUMNS}
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
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { DollarSign, Fuel, Wrench } from "lucide-react";
import StatCard from "../../components/common/StatCard";
import FilterBar from "../../components/common/FilterBar";
import Select from "../../components/common/Select";
import { generatorService } from "../../services/generatorService";
import { formatNumber } from "../../utils/formatNumber";

const CURRENT_YEAR = new Date().getUTCFullYear();
// Same range as GeneratorReportOperatingCost's own year picker, for the same reason.
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 4 + i).map((y) => ({ value: String(y), label: String(y) }));

/**
 * Spec 4.2's "cost-analysis dashboard" — fuel cost, maintenance cost and
 * their combined total for a chosen year, fleet-wide or for one generator.
 * Reuses getOperatingCostReport for these totals since it's already the
 * yearly, 12-month-complete endpoint the dashboard's charts (AAS-368/369)
 * are built on. The per-generator breakdown/consumption charts come next.
 */
export default function GeneratorReportCostAnalysis({ generatorOptions }) {
  const [generatorId, setGeneratorId] = useState("");
  const [year, setYear] = useState("");

  const [operating, setOperating] = useState(null);

  // Loading/error handling for this whole dashboard (the totals row here,
  // plus the trend and breakdown charts still to come) lands together in
  // AAS-370 once all three report fetches exist — the StatCards below just
  // show "—" until the first response arrives.
  const load = useCallback(async () => {
    try {
      const data = await generatorService.getOperatingCostReport({
        ...(generatorId ? { generatorId } : {}),
        ...(year ? { year } : {}),
      });
      setOperating(data);
    } catch {
      setOperating(null);
    }
  }, [generatorId, year]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = () => {
    setGeneratorId("");
    setYear("");
  };

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        filters={
          <>
            <Select value={generatorId} onChange={(e) => setGeneratorId(e.target.value)} options={generatorOptions} placeholder="All generators" />
            <Select value={year} onChange={(e) => setYear(e.target.value)} options={YEAR_OPTIONS} placeholder={`${CURRENT_YEAR} (current)`} />
          </>
        }
        onReset={generatorId || year ? handleReset : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={`Fuel Cost — ${operating?.year ?? "—"}`} value={operating ? formatNumber(operating.totalFuelCost) : "—"} icon={Fuel} />
        <StatCard label={`Maintenance Cost — ${operating?.year ?? "—"}`} value={operating ? formatNumber(operating.totalMaintenanceCost) : "—"} icon={Wrench} />
        <StatCard label={`Total Operating Cost — ${operating?.year ?? "—"}`} value={operating ? formatNumber(operating.totalOperatingCost) : "—"} icon={DollarSign} />
      </div>
    </div>
  );
}

import { useEffect, useState, lazy, Suspense } from "react";
import Tabs from "../../components/common/Tabs";
import { LoadingSpinner } from "../../components/common/Loading";
import { generatorService } from "../../services/generatorService";

// Lazy per tab: these seven panels pull in recharts (a large charting
// library) between them, so loading all of them - and the chart library -
// up front made this page's chunk ~400KB even though only one tab is ever
// visible at a time. Each one now loads only when its tab is opened.
const GeneratorReportRunningHours = lazy(() => import("./GeneratorReportRunningHours"));
const GeneratorReportDieselConsumption = lazy(() => import("./GeneratorReportDieselConsumption"));
const GeneratorReportFuelCost = lazy(() => import("./GeneratorReportFuelCost"));
const GeneratorReportMaintenanceCost = lazy(() => import("./GeneratorReportMaintenanceCost"));
const GeneratorReportOperatingCost = lazy(() => import("./GeneratorReportOperatingCost"));
const GeneratorReportServiceHistory = lazy(() => import("./GeneratorReportServiceHistory"));
const GeneratorReportCostAnalysis = lazy(() => import("./GeneratorReportCostAnalysis"));

// All seven spec 4.2 reports this page covers, in the order they read most
// naturally (usage first, then cost, then the yearly/history rollups, then
// the cost-analysis dashboard last since it's a summary built on top of the
// others). Cost-analysis is the fleet cost-summary + operating-cost data
// charted, S2.13 (its endpoint shipped back in S2.11).
const REPORT_TABS = [
  { id: "running-hours", label: "Running Hours" },
  { id: "diesel-consumption", label: "Diesel Consumption" },
  { id: "fuel-cost", label: "Fuel Cost" },
  { id: "maintenance-cost", label: "Maintenance Cost" },
  { id: "operating-cost", label: "Operating Cost" },
  { id: "service-history", label: "Service History" },
  { id: "cost-analysis", label: "Cost Analysis" },
];

// One component per REPORT_TABS entry.
const REPORT_VIEWS = {
  "running-hours": GeneratorReportRunningHours,
  "diesel-consumption": GeneratorReportDieselConsumption,
  "fuel-cost": GeneratorReportFuelCost,
  "maintenance-cost": GeneratorReportMaintenanceCost,
  "operating-cost": GeneratorReportOperatingCost,
  "service-history": GeneratorReportServiceHistory,
  "cost-analysis": GeneratorReportCostAnalysis,
};

/**
 * The Generator section's reports: one panel per spec 4.2 report, switched
 * by an in-page tab strip (not routed — these aren't separate URLs, unlike
 * the Registry/Logs/Maintenance tabs in GeneratorLayout). The generator
 * filter dropdown's options are fetched once here and handed down, so each
 * panel doesn't repeat the same request.
 */
export default function GeneratorReportsPage() {
  const [tab, setTab] = useState(REPORT_TABS[0].id);
  const [generatorOptions, setGeneratorOptions] = useState([]);

  useEffect(() => {
    generatorService
      .listGenerators({ pageSize: 200 })
      .then(({ items }) => setGeneratorOptions(items.map((g) => ({ value: g._id, label: g.tag }))))
      .catch(() => {
        // The filter dropdown just stays empty (only "All generators"); each
        // panel's own report load has its own error handling.
      });
  }, []);

  const ReportView = REPORT_VIEWS[tab];

  return (
    <div className="flex flex-col gap-5">
      <Tabs tabs={REPORT_TABS} value={tab} onChange={setTab} label="Report type" />
      <Suspense fallback={<LoadingSpinner label="Loading report…" />}>
        <ReportView generatorOptions={generatorOptions} />
      </Suspense>
    </div>
  );
}

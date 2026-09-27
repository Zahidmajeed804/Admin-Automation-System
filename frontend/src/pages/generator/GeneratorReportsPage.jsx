import { useEffect, useState } from "react";
import Tabs from "../../components/common/Tabs";
import { generatorService } from "../../services/generatorService";
import GeneratorReportRunningHours from "./GeneratorReportRunningHours";
import GeneratorReportDieselConsumption from "./GeneratorReportDieselConsumption";
import GeneratorReportFuelCost from "./GeneratorReportFuelCost";
import GeneratorReportMaintenanceCost from "./GeneratorReportMaintenanceCost";
import GeneratorReportOperatingCost from "./GeneratorReportOperatingCost";
import GeneratorReportServiceHistory from "./GeneratorReportServiceHistory";

// The six spec 4.2 reports this page covers, in the order they read most
// naturally (usage first, then cost, then the yearly/history rollups).
// Cost-analysis (fleet cost-summary with % share) is deliberately NOT one of
// these tabs — it's the data behind S2.13's dashboard, a later story, even
// though its endpoint already exists from S2.11.
const REPORT_TABS = [
  { id: "running-hours", label: "Running Hours" },
  { id: "diesel-consumption", label: "Diesel Consumption" },
  { id: "fuel-cost", label: "Fuel Cost" },
  { id: "maintenance-cost", label: "Maintenance Cost" },
  { id: "operating-cost", label: "Operating Cost" },
  { id: "service-history", label: "Service History" },
];

// One component per REPORT_TABS entry.
const REPORT_VIEWS = {
  "running-hours": GeneratorReportRunningHours,
  "diesel-consumption": GeneratorReportDieselConsumption,
  "fuel-cost": GeneratorReportFuelCost,
  "maintenance-cost": GeneratorReportMaintenanceCost,
  "operating-cost": GeneratorReportOperatingCost,
  "service-history": GeneratorReportServiceHistory,
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
      <ReportView generatorOptions={generatorOptions} />
    </div>
  );
}

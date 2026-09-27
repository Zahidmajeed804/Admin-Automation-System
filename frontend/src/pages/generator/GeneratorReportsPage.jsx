import { useEffect, useState } from "react";
import Card from "../../components/common/Card";
import Tabs from "../../components/common/Tabs";
import { generatorService } from "../../services/generatorService";
import GeneratorReportRunningHours from "./GeneratorReportRunningHours";
import GeneratorReportDieselConsumption from "./GeneratorReportDieselConsumption";
import GeneratorReportFuelCost from "./GeneratorReportFuelCost";
import GeneratorReportMaintenanceCost from "./GeneratorReportMaintenanceCost";

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

// Filled in one pair at a time as each report view ships in this story
// (running-hours/diesel-consumption, then fuel-cost/maintenance-cost, then
// operating-cost/service-history); a tab not yet in here falls back to
// NotBuiltYet below.
const REPORT_VIEWS = {
  "running-hours": GeneratorReportRunningHours,
  "diesel-consumption": GeneratorReportDieselConsumption,
  "fuel-cost": GeneratorReportFuelCost,
  "maintenance-cost": GeneratorReportMaintenanceCost,
};

function NotBuiltYet({ label }) {
  return (
    <Card className="flex flex-col items-center justify-center text-center gap-2 py-16">
      <p className="text-card-heading text-ink">{label}</p>
      <p className="text-body text-ink-muted max-w-sm">This report is being built out in this same story.</p>
    </Card>
  );
}

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
  const activeLabel = REPORT_TABS.find((t) => t.id === tab)?.label;

  return (
    <div className="flex flex-col gap-5">
      <Tabs tabs={REPORT_TABS} value={tab} onChange={setTab} label="Report type" />
      {ReportView ? <ReportView generatorOptions={generatorOptions} /> : <NotBuiltYet label={activeLabel} />}
    </div>
  );
}

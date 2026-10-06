import { useEffect, useState } from "react";
import Tabs from "../../components/common/Tabs";
import { userService } from "../../services/userService";
import AttendanceSummaryView from "./AttendanceSummaryView";
import OvertimeSummaryView from "./OvertimeSummaryView";
import LeaveUsageView from "./LeaveUsageView";

const REPORT_TABS = [
  { id: "attendance-summary", label: "Attendance Summary" },
  { id: "overtime-summary", label: "Overtime Summary" },
  { id: "leave-usage", label: "Leave Usage" },
];

// One component per REPORT_TABS entry.
const REPORT_VIEWS = {
  "attendance-summary": AttendanceSummaryView,
  "overtime-summary": OvertimeSummaryView,
  "leave-usage": LeaveUsageView,
};

/**
 * Cross-module reports (Module 7): Attendance/Overtime/Leave summaries,
 * switched by an in-page tab strip — same pattern as GeneratorReportsPage.
 * The employee filter dropdown's options are fetched once here and handed
 * down, so each panel doesn't repeat the same request.
 */
export default function ReportsPage() {
  const [tab, setTab] = useState(REPORT_TABS[0].id);
  const [employeeOptions, setEmployeeOptions] = useState([]);

  useEffect(() => {
    userService
      .options()
      .then((users) => setEmployeeOptions(users.map((u) => ({ value: u._id, label: u.name }))))
      .catch(() => {
        // The filter dropdown just stays empty (only "All employees"); each
        // panel's own report load has its own error handling.
      });
  }, []);

  const ReportView = REPORT_VIEWS[tab];

  return (
    <div className="flex flex-col gap-5">
      <Tabs tabs={REPORT_TABS} value={tab} onChange={setTab} label="Report type" />
      <ReportView employeeOptions={employeeOptions} />
    </div>
  );
}

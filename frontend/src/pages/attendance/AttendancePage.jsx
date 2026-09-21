import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/common/PageHeader";
import Tabs from "../../components/common/Tabs";
import ClockWidget from "../../components/attendance/ClockWidget";
import AttendanceHistoryTable from "../../components/attendance/AttendanceHistoryTable";
import TeamAttendanceTable from "../../components/attendance/TeamAttendanceTable";

const tabs = [
  { id: "mine", label: "My attendance" },
  { id: "team", label: "Team" },
];

export default function AttendancePage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Bumped after every clock-in/out so the history table re-fetches.
  const [refreshKey, setRefreshKey] = useState(0);

  // Team view is for users who can edit attendance; everyone else only sees
  // their own records (the API enforces the same rule independently).
  const canViewTeam = hasPermission("attendance.update");
  const activeTab = canViewTeam && searchParams.get("tab") === "team" ? "team" : "mine";
  const selectTab = (id) => setSearchParams(id === "team" ? { tab: "team" } : {}, { replace: true });

  const panelProps = canViewTeam
    ? { role: "tabpanel", id: `panel-${activeTab}`, "aria-labelledby": `tab-${activeTab}` }
    : {};

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Clock in and out, and review your attendance history."
      />
      {canViewTeam && <Tabs tabs={tabs} value={activeTab} onChange={selectTab} label="Attendance views" />}
      <div className="flex flex-col gap-6" {...panelProps}>
        {activeTab === "team" ? (
          <TeamAttendanceTable />
        ) : (
          <>
            <ClockWidget onChange={() => setRefreshKey((k) => k + 1)} />
            <section className="flex flex-col gap-3">
              <h2 className="text-section-heading text-ink">My attendance history</h2>
              <AttendanceHistoryTable refreshKey={refreshKey} />
            </section>
          </>
        )}
      </div>
    </>
  );
}

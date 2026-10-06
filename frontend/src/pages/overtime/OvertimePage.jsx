import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSelfServiceVisible } from "../../config/featureVisibility";
import PageHeader from "../../components/common/PageHeader";
import AttendanceSectionNav from "../../components/attendance/AttendanceSectionNav";
import Tabs from "../../components/common/Tabs";
import OvertimeHistoryTable from "../../components/overtime/OvertimeHistoryTable";
import PendingOvertimeTable from "../../components/overtime/PendingOvertimeTable";
import TeamOvertimeTable from "../../components/overtime/TeamOvertimeTable";

const reviewTabs = [
  { id: "pending", label: "Pending approvals" },
  { id: "team", label: "Team" },
];

export default function OvertimePage() {
  const { hasPermission } = useAuth();
  const selfServiceVisible = useSelfServiceVisible();
  const [searchParams, setSearchParams] = useSearchParams();
  // Reviewing is for users who can approve overtime; the API enforces the same rule independently.
  const canReview = hasPermission("overtime.approve");
  // Admin doesn't clock in, so they have no overtime of their own. If they somehow can't
  // review either (misconfigured roles), fall back to showing it rather than nothing.
  const showMine = selfServiceVisible || !canReview;

  const activeReviewTab = canReview && searchParams.get("view") === "team" ? "team" : "pending";
  const selectReviewTab = (id) => setSearchParams(id === "team" ? { view: "team" } : {}, { replace: true });

  return (
    <>
      <PageHeader
        title="Overtime"
        description="Overtime is calculated automatically when you clock out, then reviewed by a manager."
      />
      <AttendanceSectionNav />
      <div className="flex flex-col gap-8">
        {canReview && (
          <section
            className="flex flex-col gap-3"
            role="tabpanel"
            id={`panel-${activeReviewTab}`}
            aria-labelledby={`tab-${activeReviewTab}`}
          >
            <Tabs tabs={reviewTabs} value={activeReviewTab} onChange={selectReviewTab} label="Overtime review views" />
            {activeReviewTab === "team" ? <TeamOvertimeTable /> : <PendingOvertimeTable />}
          </section>
        )}
        {showMine && (
          <section className="flex flex-col gap-3">
            <h2 className="text-section-heading text-ink">My overtime</h2>
            <OvertimeHistoryTable />
          </section>
        )}
      </div>
    </>
  );
}

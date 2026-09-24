import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/common/PageHeader";
import AttendanceSectionNav from "../../components/attendance/AttendanceSectionNav";
import OvertimeHistoryTable from "../../components/overtime/OvertimeHistoryTable";
import PendingOvertimeTable from "../../components/overtime/PendingOvertimeTable";

export default function OvertimePage() {
  const { hasPermission } = useAuth();
  // Reviewing is for users who can approve overtime; the API enforces the same rule independently.
  const canReview = hasPermission("overtime.approve");

  return (
    <>
      <PageHeader
        title="Overtime"
        description="Overtime is calculated automatically when you clock out, then reviewed by a manager."
      />
      <AttendanceSectionNav />
      <div className="flex flex-col gap-8">
        {canReview && (
          <section className="flex flex-col gap-3">
            <h2 className="text-section-heading text-ink">Pending approvals</h2>
            <PendingOvertimeTable />
          </section>
        )}
        <section className="flex flex-col gap-3">
          <h2 className="text-section-heading text-ink">My overtime</h2>
          <OvertimeHistoryTable />
        </section>
      </div>
    </>
  );
}

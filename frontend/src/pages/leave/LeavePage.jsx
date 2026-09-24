import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/common/PageHeader";
import Button from "../../components/common/Button";
import RequestLeaveModal from "../../components/leave/RequestLeaveModal";
import LeaveHistoryTable from "../../components/leave/LeaveHistoryTable";
import PendingLeaveTable from "../../components/leave/PendingLeaveTable";
import { formatDate } from "../../utils/attendanceFormat";

export default function LeavePage() {
  const { hasPermission } = useAuth();
  const [requesting, setRequesting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  // Bumped after every new request so the history table re-fetches.
  const [refreshKey, setRefreshKey] = useState(0);

  // Requesting is for users who can submit leave; the API enforces the same rule independently.
  const canRequest = hasPermission("leave.create");
  // Approve and reject are separate permissions; the pending list is for anyone who holds either.
  const canApprove = hasPermission("leave.approve");
  const canReject = hasPermission("leave.reject");

  return (
    <>
      <PageHeader
        title="Leave"
        description="Request time off and follow its approval."
        action={
          canRequest && (
            <Button
              icon={CalendarPlus}
              onClick={() => {
                setSubmitted(null);
                setRequesting(true);
              }}
            >
              Request leave
            </Button>
          )
        }
      />
      {submitted && (
        <div
          role="status"
          className="bg-status-successBg border border-green-200 text-status-success text-body rounded-md px-3 py-2"
        >
          Leave request submitted for {formatDate(submitted.startDate)}
          {submitted.totalDays > 1 && ` to ${formatDate(submitted.endDate)}`} ({submitted.totalDays}{" "}
          {submitted.totalDays === 1 ? "day" : "days"}). It is pending approval.
        </div>
      )}
      {(canApprove || canReject) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-section-heading text-ink">Pending approvals</h2>
          <PendingLeaveTable canApprove={canApprove} canReject={canReject} refreshKey={refreshKey} />
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-section-heading text-ink">My leave requests</h2>
        <LeaveHistoryTable refreshKey={refreshKey} />
      </section>
      <RequestLeaveModal
        open={requesting}
        onClose={() => setRequesting(false)}
        onSubmitted={(leave) => {
          setRequesting(false);
          setSubmitted(leave);
          setRefreshKey((k) => k + 1);
        }}
      />
    </>
  );
}

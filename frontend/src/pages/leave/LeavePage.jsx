import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/common/PageHeader";
import Button from "../../components/common/Button";
import RequestLeaveModal from "../../components/leave/RequestLeaveModal";
import { formatDate } from "../../utils/attendanceFormat";

export default function LeavePage() {
  const { hasPermission } = useAuth();
  const [requesting, setRequesting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  // Requesting is for users who can submit leave; the API enforces the same rule independently.
  const canRequest = hasPermission("leave.create");

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
      <RequestLeaveModal
        open={requesting}
        onClose={() => setRequesting(false)}
        onSubmitted={(leave) => {
          setRequesting(false);
          setSubmitted(leave);
        }}
      />
    </>
  );
}

import { useState } from "react";
import { leaveService } from "../../services/leaveService";
import ConfirmDialog from "../modals/ConfirmDialog";
import Input from "../common/Input";
import { formatLeaveDate, leaveTypeLabel } from "../../utils/leaveFormat";
import { apiErrorMessage } from "../../utils/apiError";

const copy = {
  approved: { title: "Approve leave", verb: "Approve", variant: "primary" },
  rejected: { title: "Reject leave", verb: "Reject", variant: "danger" },
};

function ReviewForm({ request, decision, onClose, onDone }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // 409 means someone else already decided it, so the list behind the dialog is stale.
  const [stale, setStale] = useState(false);
  const { title, verb, variant } = copy[decision];

  const confirm = async () => {
    setSaving(true);
    setError("");
    try {
      // The note is optional; send it only when the reviewer wrote one.
      await leaveService.review(request._id, { decision, ...(note.trim() && { note: note.trim() }) });
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save the decision. Please try again."));
      setStale(err?.response?.status === 409);
      setSaving(false);
    }
  };

  const close = stale ? onDone : onClose;
  const dates =
    request.totalDays > 1
      ? `${formatLeaveDate(request.startDate)} – ${formatLeaveDate(request.endDate)}`
      : formatLeaveDate(request.startDate);
  const days = `${request.totalDays} ${request.totalDays === 1 ? "day" : "days"}`;

  return (
    <ConfirmDialog
      open
      // Don't let Escape/backdrop/X discard an in-flight decision.
      onClose={saving ? undefined : close}
      onConfirm={confirm}
      title={title}
      description={`${verb} ${(leaveTypeLabel[request.leaveType] ?? request.leaveType).toLowerCase()} for ${request.user?.name || "this employee"} (${dates}, ${days})?`}
      confirmLabel={verb}
      variant={variant}
      loading={saving}
      error={error}
    >
      <Input
        label="Note (optional)"
        name="reviewNote"
        id="review-leave-note"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Shown to the employee"
        helperText={`${note.length}/500`}
      />
    </ConfirmDialog>
  );
}

/**
 * Approve/reject one leave request. Pass the row as `request` and the decision
 * ("approved" | "rejected") to open it; `onDone` fires after a successful review
 * (the caller closes and refreshes). Keyed by request and decision so each
 * opening starts with an empty note and no stale error.
 */
export default function ReviewLeaveDialog({ request, decision, onClose, onDone }) {
  if (!request || !decision) return null;
  return <ReviewForm key={`${request._id}:${decision}`} request={request} decision={decision} onClose={onClose} onDone={onDone} />;
}

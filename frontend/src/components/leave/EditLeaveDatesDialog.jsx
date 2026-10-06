import { useState } from "react";
import { leaveService } from "../../services/leaveService";
import Modal from "../modals/Modal";
import Button from "../common/Button";
import DatePicker from "../common/DatePicker";
import { apiErrorMessage } from "../../utils/apiError";
import {
  appliedDays,
  formatLeaveDate,
  inclusiveDays,
  leaveTypeLabel,
  toLeaveDateStr,
} from "../../utils/leaveFormat";

const FORM_ID = "edit-leave-dates-form";

const plural = (n) => `${n} ${n === 1 ? "day" : "days"}`;

function EditDatesForm({ request, onClose, onSaved }) {
  const initial = { startDate: toLeaveDateStr(request.startDate), endDate: toLeaveDateStr(request.endDate) };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const days = inclusiveDays(form.startDate, form.endDate);
  const rangeError = form.startDate && form.endDate && days === 0 ? "To can't be before From." : "";
  const unchanged = form.startDate === initial.startDate && form.endDate === initial.endDate;
  const canSubmit = Boolean(form.startDate && form.endDate) && !rangeError && !unchanged && !saving;

  const applied = appliedDays(request);
  const appliedFrom = request.originalStartDate ?? request.startDate;
  const appliedTo = request.originalEndDate ?? request.endDate;

  // Moving From past To drags To along, like the request form.
  const setStart = (startDate) =>
    setForm((f) => ({ startDate, endDate: f.endDate && f.endDate < startDate ? startDate : f.endDate }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setSubmitError("");
    try {
      const updated = await leaveService.editDates(request._id, form);
      onSaved(updated);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Couldn't change these dates. Please try again."));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      // Don't let Escape/backdrop/X discard an in-flight save.
      onClose={saving ? undefined : onClose}
      title="Edit leave dates"
      description={`${request.user?.name || "Unknown user"} · ${leaveTypeLabel[request.leaveType] ?? request.leaveType}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving} disabled={!canSubmit}>
            Save dates
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {submitError && (
          <div
            role="alert"
            className="bg-status-errorBg border border-red-200 text-status-error text-body rounded-md px-3 py-2"
          >
            {submitError}
          </div>
        )}
        <p className="text-body text-ink-secondary">
          Applied for <span className="font-medium text-ink">{plural(applied)}</span>:{" "}
          {formatLeaveDate(appliedFrom)} – {formatLeaveDate(appliedTo)}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker label="From" id="edit-leave-start" required value={form.startDate} onChange={setStart} />
          <DatePicker
            label="To"
            id="edit-leave-end"
            required
            value={form.endDate}
            min={form.startDate || undefined}
            onChange={(endDate) => setForm((f) => ({ ...f, endDate }))}
            error={rangeError || undefined}
            helperText={!rangeError && days > 0 ? `${plural(days)}` : undefined}
          />
        </div>
        <p className="text-helper text-ink-muted">
          Saving changes the request&apos;s dates; you still approve or reject it afterwards. The new dates must not
          overlap the person&apos;s other leave and must fit their balance. The applied dates are kept.
        </p>
      </form>
    </Modal>
  );
}

/**
 * Lets a reviewer change the dates of a pending leave request that was applied for
 * more than 2 days, before approving or rejecting it. Pass the request row as
 * `request` (null hides it). `onSaved` fires with the updated request.
 */
export default function EditLeaveDatesDialog({ request, onClose, onSaved }) {
  if (!request) return null;
  return <EditDatesForm key={request._id} request={request} onClose={onClose} onSaved={onSaved} />;
}

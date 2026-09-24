import { useState } from "react";
import { leaveService } from "../../services/leaveService";
import Modal from "../modals/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import { leaveTypeOptions, inclusiveDays } from "../../utils/leaveFormat";
import { apiErrorMessage } from "../../utils/apiError";

const FORM_ID = "request-leave-form";

const emptyForm = { leaveType: "casual", startDate: "", endDate: "", reason: "" };

function RequestForm({ onClose, onSubmitted }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  // Keep the range valid as dates change: a later start drags the end along, and an
  // empty end follows the start so a one-day request only needs one date picked.
  const setStart = (e) => {
    const startDate = e.target.value;
    setForm((f) => ({ ...f, startDate, endDate: !f.endDate || f.endDate < startDate ? startDate : f.endDate }));
  };

  const days = inclusiveDays(form.startDate, form.endDate);
  const rangeError = form.startDate && form.endDate && days === 0 ? "End date must not be before the start date." : undefined;
  const canSubmit = Boolean(form.leaveType && form.startDate && form.endDate) && !rangeError && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const payload = { leaveType: form.leaveType, startDate: form.startDate, endDate: form.endDate };
    const reason = form.reason.trim();
    if (reason) payload.reason = reason;

    setSaving(true);
    setSubmitError("");
    try {
      const leave = await leaveService.create(payload);
      onSubmitted(leave);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Couldn't submit your request. Please try again."));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      // Don't let Escape/backdrop/X discard an in-flight submission.
      onClose={saving ? undefined : onClose}
      title="Request leave"
      description="Your manager will review it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving} disabled={!canSubmit}>
            Submit request
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
        <Select
          label="Leave type"
          name="leaveType"
          id="leave-type"
          required
          value={form.leaveType}
          onChange={setField("leaveType")}
          options={leaveTypeOptions}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="From"
            type="date"
            name="startDate"
            id="leave-start"
            required
            value={form.startDate}
            onChange={setStart}
          />
          <Input
            label="To"
            type="date"
            name="endDate"
            id="leave-end"
            required
            value={form.endDate}
            min={form.startDate || undefined}
            onChange={setField("endDate")}
            error={rangeError}
            helperText={days > 0 ? `${days} ${days === 1 ? "day" : "days"}` : undefined}
          />
        </div>
        <Input
          label="Reason (optional)"
          name="reason"
          id="leave-reason"
          value={form.reason}
          maxLength={500}
          onChange={setField("reason")}
          placeholder="Shown to your manager"
          helperText={`${form.reason.length}/500`}
        />
      </form>
    </Modal>
  );
}

/**
 * Form for an employee to request leave. Set `open` to show it; `onSubmitted`
 * fires with the created request after a successful POST (the caller closes it).
 * Unmounted while closed, so every opening starts with an empty form.
 */
export default function RequestLeaveModal({ open, onClose, onSubmitted }) {
  if (!open) return null;
  return <RequestForm onClose={onClose} onSubmitted={onSubmitted} />;
}

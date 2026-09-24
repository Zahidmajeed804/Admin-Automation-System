import { useState } from "react";
import { attendanceService } from "../../services/attendanceService";
import Modal from "../modals/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import { formatDate, toDateTimeLocalValue } from "../../utils/attendanceFormat";
import { apiErrorMessage } from "../../utils/apiError";

const statusOptions = [
  { value: "present", label: "Present" },
  { value: "half-day", label: "Half day" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
];

const FORM_ID = "edit-attendance-form";

const serverMessage = (err) => apiErrorMessage(err, "Couldn't save changes. Please try again.");

function EditForm({ record, onClose, onSaved }) {
  const initial = {
    clockIn: toDateTimeLocalValue(record.clockIn),
    clockOut: toDateTimeLocalValue(record.clockOut),
    status: record.status,
    notes: record.notes || "",
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  // The API can't clear a clock time, so don't let the form pretend it can.
  const errors = {};
  if (initial.clockIn && !form.clockIn) errors.clockIn = "Clock in can't be removed.";
  if (initial.clockOut && !form.clockOut) errors.clockOut = "Clock out can't be removed.";
  else if (form.clockOut && !form.clockIn) errors.clockOut = "Add a clock in time first.";
  else if (form.clockOut && form.clockIn && new Date(form.clockOut) < new Date(form.clockIn)) {
    errors.clockOut = "Clock out must be after clock in.";
  }

  const changed = Object.keys(initial).filter((key) => form[key] !== initial[key]);
  const timesChanged = changed.includes("clockIn") || changed.includes("clockOut");
  const canSave = changed.length > 0 && Object.keys(errors).length === 0 && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    // PATCH only what changed: untouched times keep their seconds, and the
    // server recomputes worked time/status only when a time actually changes.
    const payload = {};
    if (changed.includes("clockIn")) payload.clockIn = new Date(form.clockIn).toISOString();
    if (changed.includes("clockOut")) payload.clockOut = new Date(form.clockOut).toISOString();
    if (changed.includes("status")) payload.status = form.status;
    if (changed.includes("notes")) payload.notes = form.notes;

    setSaving(true);
    setSubmitError("");
    try {
      await attendanceService.update(record._id, payload);
      onSaved();
    } catch (err) {
      setSubmitError(serverMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      // Don't let Escape/backdrop/X discard an in-flight save.
      onClose={saving ? undefined : onClose}
      title="Edit attendance"
      description={`${record.user?.name || "Unknown user"} · ${formatDate(record.date)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving} disabled={!canSave}>
            Save changes
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Clock in"
            type="datetime-local"
            name="clockIn"
            id="edit-clock-in"
            value={form.clockIn}
            onChange={setField("clockIn")}
            error={errors.clockIn}
          />
          <Input
            label="Clock out"
            type="datetime-local"
            name="clockOut"
            id="edit-clock-out"
            value={form.clockOut}
            onChange={setField("clockOut")}
            error={errors.clockOut}
          />
        </div>
        <Select
          label="Status"
          name="status"
          id="edit-status"
          value={form.status}
          onChange={setField("status")}
          options={statusOptions}
          helperText={
            timesChanged && !changed.includes("status")
              ? "Worked time and status will be recalculated from the new times."
              : undefined
          }
        />
        <Input
          label="Notes"
          name="notes"
          id="edit-notes"
          value={form.notes}
          maxLength={500}
          onChange={setField("notes")}
          placeholder="Reason for the correction"
          helperText={`${form.notes.length}/500`}
        />
      </form>
    </Modal>
  );
}

/**
 * Manager correction of one attendance record. Pass the row as `record` to open
 * it; `onSaved` fires after a successful PATCH (the caller closes and refreshes).
 * Keyed by record id so each opened record starts from its own values.
 */
export default function EditAttendanceModal({ record, onClose, onSaved }) {
  if (!record) return null;
  return <EditForm key={record._id} record={record} onClose={onClose} onSaved={onSaved} />;
}

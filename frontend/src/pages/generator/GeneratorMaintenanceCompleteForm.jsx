import { useEffect, useState } from "react";
import Modal from "../../components/modals/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import HoursMinutesInput from "../../components/common/HoursMinutesInput";
import DatePicker from "../../components/common/DatePicker";
import { generatorService } from "../../services/generatorService";
import { extractErrorMessage } from "./GeneratorForm";

const todayDate = () => new Date().toISOString().slice(0, 10);

const BLANK = {
  completedDate: "",
  performedBy: "",
  vendor: "",
  cost: "",
  partsReplaced: "",
  hoursAtService: "",
  notes: "",
};

// completedDate defaults to today rather than being left blank, since a
// service is almost always logged the day it happened.
function initialValues(job) {
  return { ...BLANK, completedDate: todayDate(), vendor: job?.vendor ?? "" };
}

/**
 * Marks a scheduled job completed. A separate operation from editing —
 * completing recalculates the generator's running hours and, for a
 * recurring job, schedules the next occurrence, none of which a plain edit
 * (GeneratorMaintenanceForm) does.
 */
export default function GeneratorMaintenanceCompleteForm({ open, onClose, onSaved, job }) {
  const [values, setValues] = useState(() => initialValues(job));
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initialValues(job));
      setFieldErrors({});
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job]);

  const setField = (key) => (eventOrValue) => {
    const value = eventOrValue?.target ? eventOrValue.target.value : eventOrValue;
    setValues((v) => ({ ...v, [key]: value }));
  };

  const validate = () => {
    const next = {};
    if (values.cost !== "" && !(Number(values.cost) >= 0)) next.cost = "Cost must be 0 or more";
    if (values.hoursAtService !== "" && !(Number(values.hoursAtService) >= 0)) next.hoursAtService = "Running hours must be 0 or more";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!job || !validate()) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const payload = { status: "completed" };
      if (values.completedDate) payload.completedDate = values.completedDate;
      if (values.performedBy.trim()) payload.performedBy = values.performedBy.trim();
      if (values.vendor.trim()) payload.vendor = values.vendor.trim();
      if (values.cost !== "") payload.cost = Number(values.cost);
      if (values.partsReplaced.trim()) payload.partsReplaced = values.partsReplaced.trim();
      if (values.hoursAtService !== "") payload.hoursAtService = Number(values.hoursAtService);
      if (values.notes.trim()) payload.notes = values.notes.trim();

      const result = await generatorService.updateMaintenance(job._id, payload);
      onSaved(result);
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!job) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Complete Maintenance"
      description={job.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            Mark Complete
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {submitError && (
          <p className="text-body text-status-error bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {submitError}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePicker id="complete-completedDate" label="Completed Date" value={values.completedDate} onChange={setField("completedDate")} />
          <HoursMinutesInput
            id="complete-hoursAtService"
            label="Generator's Running Hours"
            value={values.hoursAtService}
            onChange={setField("hoursAtService")}
            error={fieldErrors.hoursAtService}
            helperText="Defaults to the generator's current running hours if left blank"
          />
          <Input id="complete-performedBy" label="Technician" value={values.performedBy} onChange={setField("performedBy")} />
          <Input id="complete-vendor" label="Vendor" value={values.vendor} onChange={setField("vendor")} placeholder="e.g. PSO Services" />
          <Input id="complete-cost" label="Cost" type="number" min="0" step="0.01" value={values.cost} onChange={setField("cost")} error={fieldErrors.cost} />
          <Input id="complete-partsReplaced" label="Parts Replaced" value={values.partsReplaced} onChange={setField("partsReplaced")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="complete-notes" className="text-body font-medium text-ink-secondary">
            Notes
          </label>
          <textarea
            id="complete-notes"
            rows={3}
            value={values.notes}
            onChange={setField("notes")}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
      </form>
    </Modal>
  );
}

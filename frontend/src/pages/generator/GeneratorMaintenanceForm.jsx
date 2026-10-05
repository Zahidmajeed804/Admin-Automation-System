import { useEffect, useState } from "react";
import Modal from "../../components/modals/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import HoursMinutesInput from "../../components/common/HoursMinutesInput";
import { generatorService } from "../../services/generatorService";
import { extractErrorMessage } from "./GeneratorForm";

const TYPE_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "unscheduled", label: "Unscheduled" },
  { value: "inspection", label: "Inspection" },
];

const BLANK = {
  generatorId: "",
  description: "",
  type: "scheduled",
  scheduledDate: "",
  intervalDays: "",
  alertThresholdDays: "",
  intervalHours: "",
  alertThresholdHours: "",
  hoursAtScheduling: "",
  performedBy: "",
  vendor: "",
  cost: "",
  partsReplaced: "",
  notes: "",
};

const str = (v) => (v === undefined || v === null ? "" : String(v));

// A stored job -> the form's string values, for editing it.
export function toEditValues(job) {
  return {
    ...BLANK,
    generatorId: job.generator?._id ?? job.generator ?? "",
    description: job.description ?? "",
    type: job.type ?? "scheduled",
    scheduledDate: job.scheduledDate ? String(job.scheduledDate).slice(0, 10) : "",
    intervalDays: str(job.intervalDays),
    alertThresholdDays: str(job.alertThresholdDays),
    intervalHours: str(job.intervalHours),
    alertThresholdHours: str(job.alertThresholdHours),
    hoursAtScheduling: str(job.hoursAtScheduling),
    performedBy: str(job.performedBy),
    vendor: str(job.vendor),
    cost: str(job.cost),
    partsReplaced: str(job.partsReplaced),
    notes: str(job.notes),
  };
}

// Optional numbers that the backend accepts null for, to actively stop a job
// recurring by that measure — everything else the backend has no "clear"
// support for, so a blank field there is left out rather than force-cleared.
const NULLABLE_ON_EDIT = ["intervalDays", "intervalHours"];
// Optional numbers with no null-clearing: a blank field is omitted, not sent.
const OMIT_IF_BLANK = ["alertThresholdDays", "alertThresholdHours", "hoursAtScheduling", "cost"];
// Optional text: blank is sent as "", which does clear it (unlike the numbers above).
const TEXT_FIELDS = ["performedBy", "vendor", "partsReplaced", "notes"];

// Blank optional fields are left out entirely, so the backend's own defaults
// (e.g. alertThresholdDays: 7, alertThresholdHours: 25, type: "scheduled") apply.
export function toPayload(values) {
  const payload = {
    generatorId: values.generatorId,
    description: values.description.trim(),
    type: values.type,
    scheduledDate: values.scheduledDate,
  };
  for (const key of [...NULLABLE_ON_EDIT, ...OMIT_IF_BLANK]) {
    if (values[key] !== "") payload[key] = Number(values[key]);
  }
  for (const key of TEXT_FIELDS) {
    if (values[key].trim()) payload[key] = values[key].trim();
  }
  return payload;
}

// generatorId is never sent — the backend doesn't accept it on an edit, and
// the generator of an existing job cannot be changed.
export function toUpdatePayload(values) {
  const payload = { description: values.description.trim(), type: values.type, scheduledDate: values.scheduledDate };
  for (const key of NULLABLE_ON_EDIT) payload[key] = values[key] !== "" ? Number(values[key]) : null;
  for (const key of OMIT_IF_BLANK) {
    if (values[key] !== "") payload[key] = Number(values[key]);
  }
  for (const key of TEXT_FIELDS) payload[key] = values[key].trim();
  return payload;
}

/**
 * Create/edit modal for a maintenance job. Pass `job` to edit an existing
 * one, or omit it to schedule a new one. Completing or cancelling a job goes
 * through its own action, not this form — see GeneratorMaintenanceCompleteForm.
 */
export default function GeneratorMaintenanceForm({ open, onClose, onSaved, job, generatorOptions, defaultGeneratorId }) {
  const isEdit = Boolean(job);
  const [values, setValues] = useState(() => (job ? toEditValues(job) : { ...BLANK, generatorId: defaultGeneratorId || "" }));
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(job ? toEditValues(job) : { ...BLANK, generatorId: defaultGeneratorId || "" });
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
    if (!values.generatorId) next.generatorId = "Generator is required";
    if (!values.description.trim()) next.description = "Description is required";
    if (!values.scheduledDate) next.scheduledDate = "Scheduled date is required";
    for (const [key, label] of [
      ["intervalDays", "Interval (days)"],
      ["alertThresholdDays", "Alert threshold (days)"],
      ["intervalHours", "Interval (hours)"],
      ["alertThresholdHours", "Alert threshold (hours)"],
      ["hoursAtScheduling", "Starting hours"],
      ["cost", "Cost"],
    ]) {
      if (values[key] !== "" && !(Number(values[key]) >= 0)) next[key] = `${label} must be 0 or more`;
    }
    if (values.intervalDays !== "" && Number(values.intervalDays) < 1) next.intervalDays = "Interval (days) must be at least 1";
    if (values.intervalHours !== "" && Number(values.intervalHours) < 1) next.intervalHours = "Interval (hours) must be at least 1";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const saved = isEdit
        ? await generatorService.updateMaintenance(job._id, toUpdatePayload(values))
        : await generatorService.createMaintenance(toPayload(values));
      onSaved(saved);
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Maintenance Job" : "Schedule Maintenance"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Schedule"}
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
          <Select
            id="maintenance-generatorId"
            label="Generator"
            required
            value={values.generatorId}
            onChange={setField("generatorId")}
            options={generatorOptions}
            placeholder="Select a generator"
            disabled={isEdit}
            error={fieldErrors.generatorId}
          />
          <Select id="maintenance-type" label="Type" value={values.type} onChange={setField("type")} options={TYPE_OPTIONS} />
          <Input
            id="maintenance-description"
            label="Description"
            required
            value={values.description}
            onChange={setField("description")}
            error={fieldErrors.description}
            placeholder="e.g. Oil and filter change"
          />
          <Input
            id="maintenance-scheduledDate"
            label="Scheduled Date"
            type="date"
            required
            value={values.scheduledDate}
            onChange={setField("scheduledDate")}
            error={fieldErrors.scheduledDate}
          />
        </div>

        <div className="border-t border-border pt-4 flex flex-col gap-1">
          <span className="text-body font-medium text-ink-secondary">Recurrence &amp; alerts</span>
          <p className="text-helper text-ink-muted">Leave an interval blank for a one-off job. A job can repeat by date, by running hours, both, or neither.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="maintenance-intervalDays"
            label="Repeat Every (days)"
            type="number"
            min="1"
            value={values.intervalDays}
            onChange={setField("intervalDays")}
            error={fieldErrors.intervalDays}
          />
          <Input
            id="maintenance-alertThresholdDays"
            label="Alert Lead Time (days)"
            type="number"
            min="0"
            placeholder="7"
            value={values.alertThresholdDays}
            onChange={setField("alertThresholdDays")}
            error={fieldErrors.alertThresholdDays}
            helperText="How many days before due to flag it as upcoming"
          />
          <HoursMinutesInput
            id="maintenance-intervalHours"
            label="Repeat Every (running hours)"
            value={values.intervalHours}
            onChange={setField("intervalHours")}
            error={fieldErrors.intervalHours}
          />
          <HoursMinutesInput
            id="maintenance-alertThresholdHours"
            label="Alert Lead Time (hours)"
            value={values.alertThresholdHours}
            onChange={setField("alertThresholdHours")}
            error={fieldErrors.alertThresholdHours}
            helperText="How many running hours before due to flag it as upcoming"
          />
          {values.intervalHours !== "" && (
            <HoursMinutesInput
              id="maintenance-hoursAtScheduling"
              label="Starting Running Hours"
              value={values.hoursAtScheduling}
              onChange={setField("hoursAtScheduling")}
              error={fieldErrors.hoursAtScheduling}
              helperText="Defaults to the generator's current running hours if left blank"
              className="sm:col-span-2"
            />
          )}
        </div>

        <div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input id="maintenance-performedBy" label="Technician" value={values.performedBy} onChange={setField("performedBy")} />
          <Input id="maintenance-vendor" label="Vendor" value={values.vendor} onChange={setField("vendor")} placeholder="e.g. PSO Services" />
          <Input id="maintenance-cost" label="Cost" type="number" min="0" step="0.01" value={values.cost} onChange={setField("cost")} error={fieldErrors.cost} />
          <Input id="maintenance-partsReplaced" label="Parts Replaced" value={values.partsReplaced} onChange={setField("partsReplaced")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="maintenance-notes" className="text-body font-medium text-ink-secondary">
            Notes
          </label>
          <textarea
            id="maintenance-notes"
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

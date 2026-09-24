import { useEffect, useState } from "react";
import Modal from "../../components/modals/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import { generatorService } from "../../services/generatorService";
import { extractErrorMessage } from "./GeneratorForm";

const BLANK = {
  generatorId: "",
  date: "",
  hoursRun: "",
  meterReadingHours: "",
  fuelAddedLiters: "",
  fuelConsumedLiters: "",
  reason: "",
  notes: "",
};

// Blank optional fields are left out so the backend's defaults apply
// (date: now, fuel fields: 0).
export function toPayload(values) {
  const payload = { generatorId: values.generatorId, hoursRun: Number(values.hoursRun) };
  if (values.date) payload.date = values.date;
  if (values.meterReadingHours !== "") payload.meterReadingHours = Number(values.meterReadingHours);
  if (values.fuelAddedLiters !== "") payload.fuelAddedLiters = Number(values.fuelAddedLiters);
  if (values.fuelConsumedLiters !== "") payload.fuelConsumedLiters = Number(values.fuelConsumedLiters);
  if (values.reason.trim()) payload.reason = values.reason.trim();
  if (values.notes.trim()) payload.notes = values.notes.trim();
  return payload;
}

/**
 * Create modal for a fuel/usage log entry. `generatorOptions` is
 * [{ value, label }]; `defaultGeneratorId` preselects one. `onSaved(log)`
 * fires with the created record after a successful post.
 */
export default function GeneratorLogForm({ open, onClose, onSaved, generatorOptions, defaultGeneratorId }) {
  const [values, setValues] = useState(BLANK);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues({ ...BLANK, generatorId: defaultGeneratorId || "" });
      setFieldErrors({});
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setField = (key) => (eventOrValue) => {
    const value = eventOrValue?.target ? eventOrValue.target.value : eventOrValue;
    setValues((v) => ({ ...v, [key]: value }));
  };

  const validate = () => {
    const next = {};
    if (!values.generatorId) next.generatorId = "Generator is required";
    if (values.hoursRun === "" || Number(values.hoursRun) < 0) next.hoursRun = "Hours run is required and must be 0 or more";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const saved = await generatorService.createLog(toPayload(values));
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
      title="Add Log Entry"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            Add Log
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
            id="log-generatorId"
            label="Generator"
            required
            value={values.generatorId}
            onChange={setField("generatorId")}
            options={generatorOptions}
            placeholder="Select a generator"
            error={fieldErrors.generatorId}
          />
          <Input id="log-date" label="Date" type="date" value={values.date} onChange={setField("date")} />
          <Input
            id="log-hoursRun"
            label="Hours Run"
            type="number"
            min="0"
            step="0.1"
            required
            value={values.hoursRun}
            onChange={setField("hoursRun")}
            error={fieldErrors.hoursRun}
          />
          <Input
            id="log-meterReadingHours"
            label="Meter Reading (hours)"
            type="number"
            min="0"
            step="0.1"
            value={values.meterReadingHours}
            onChange={setField("meterReadingHours")}
          />
          <Input id="log-fuelAddedLiters" label="Fuel Added (L)" type="number" min="0" value={values.fuelAddedLiters} onChange={setField("fuelAddedLiters")} />
          <Input id="log-fuelConsumedLiters" label="Fuel Consumed (L)" type="number" min="0" value={values.fuelConsumedLiters} onChange={setField("fuelConsumedLiters")} />
          <Input id="log-reason" label="Reason" value={values.reason} onChange={setField("reason")} placeholder="e.g. power outage" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="log-notes" className="text-body font-medium text-ink-secondary">
            Notes
          </label>
          <textarea
            id="log-notes"
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

import { useEffect, useState } from "react";
import Modal from "../../components/modals/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import { generatorService } from "../../services/generatorService";
import { extractErrorMessage } from "./GeneratorForm";
import { computeFuelFigures, closingExceedsAvailable } from "../../utils/fuelFigures";
import { formatNumber } from "../../utils/formatNumber";

const BLANK = {
  generatorId: "",
  date: "",
  hoursRun: "",
  meterReadingHours: "",
  openingFuelLiters: "",
  fuelAddedLiters: "",
  closingFuelLiters: "",
  fuelConsumedLiters: "",
  fuelCostPerLiter: "",
  fuelVendor: "",
  reason: "",
  notes: "",
};

const NUMBER_FIELDS = [
  ["meterReadingHours", "Meter reading"],
  ["openingFuelLiters", "Opening fuel"],
  ["fuelAddedLiters", "Fuel added"],
  ["closingFuelLiters", "Closing fuel"],
  ["fuelConsumedLiters", "Fuel consumed"],
  ["fuelCostPerLiter", "Price per litre"],
];

// Blank optional fields are left out so the backend's defaults apply
// (date: now, fuel fields: 0). Fuel consumed and total cost are worked out
// by the server when the readings and price are given.
export function toPayload(values) {
  const payload = { generatorId: values.generatorId, hoursRun: Number(values.hoursRun) };
  if (values.date) payload.date = values.date;
  for (const [key] of NUMBER_FIELDS) {
    if (values[key] !== "") payload[key] = Number(values[key]);
  }
  if (values.fuelVendor.trim()) payload.fuelVendor = values.fuelVendor.trim();
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

  // What the server will work out on save, shown before the person submits.
  const derived = computeFuelFigures(values);
  const closingTooHigh = closingExceedsAvailable(values);
  const consumed = closingTooHigh ? undefined : derived.fuelConsumedLiters;
  const typedConsumed = values.fuelConsumedLiters !== "" ? Number(values.fuelConsumedLiters) : null;
  const replacesTyped = consumed !== undefined && typedConsumed !== null && typedConsumed !== consumed;
  const showPreview = closingTooHigh || consumed !== undefined || derived.fuelCostTotal !== undefined;

  const validate = () => {
    const next = {};
    if (!values.generatorId) next.generatorId = "Generator is required";
    if (values.hoursRun === "" || Number(values.hoursRun) < 0) next.hoursRun = "Hours run is required and must be 0 or more";
    for (const [key, label] of NUMBER_FIELDS) {
      if (values[key] !== "" && !(Number(values[key]) >= 0)) next[key] = `${label} must be 0 or more`;
    }
    // Same two rules the server enforces on POST /generator/logs.
    if (!next.closingFuelLiters && closingExceedsAvailable(values)) {
      next.closingFuelLiters = "Closing fuel cannot be more than opening plus fuel added";
    }
    if (!next.fuelCostPerLiter && values.fuelCostPerLiter !== "" && !(Number(values.fuelAddedLiters) > 0)) {
      next.fuelCostPerLiter = "Enter the litres added to use a price per litre";
    }
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
            error={fieldErrors.meterReadingHours}
          />
          <Input id="log-openingFuelLiters" label="Opening Fuel (L)" type="number" min="0" value={values.openingFuelLiters} onChange={setField("openingFuelLiters")} error={fieldErrors.openingFuelLiters} />
          <Input id="log-fuelAddedLiters" label="Fuel Added (L)" type="number" min="0" value={values.fuelAddedLiters} onChange={setField("fuelAddedLiters")} error={fieldErrors.fuelAddedLiters} />
          <Input id="log-closingFuelLiters" label="Closing Fuel (L)" type="number" min="0" value={values.closingFuelLiters} onChange={setField("closingFuelLiters")} error={fieldErrors.closingFuelLiters} />
          <Input id="log-fuelConsumedLiters" label="Fuel Consumed (L)" type="number" min="0" value={values.fuelConsumedLiters} onChange={setField("fuelConsumedLiters")} error={fieldErrors.fuelConsumedLiters} />
          <Input id="log-fuelCostPerLiter" label="Price per Litre" type="number" min="0" step="0.01" value={values.fuelCostPerLiter} onChange={setField("fuelCostPerLiter")} error={fieldErrors.fuelCostPerLiter} />
          <Input id="log-fuelVendor" label="Fuel Vendor" value={values.fuelVendor} onChange={setField("fuelVendor")} placeholder="e.g. PSO Pump" />
          {showPreview && (
            <div id="log-fuel-preview" aria-live="polite" className="sm:col-span-2 rounded-md border border-border bg-surface-subtle px-3 py-2.5 flex flex-col gap-1">
              <span className="text-helper font-semibold text-ink-secondary uppercase tracking-wide">Calculated on save</span>
              {closingTooHigh && (
                <span className="text-body text-status-error">Closing fuel is higher than opening plus fuel added, so consumption can't be worked out.</span>
              )}
              {consumed !== undefined && (
                <span className="text-body text-ink">
                  Fuel consumed: <strong>{formatNumber(consumed)} L</strong>
                  <span className="text-ink-muted">
                    {" "}({formatNumber(Number(values.openingFuelLiters))} + {formatNumber(Number(values.fuelAddedLiters) || 0)} − {formatNumber(Number(values.closingFuelLiters))})
                  </span>
                </span>
              )}
              {replacesTyped && (
                <span className="text-helper text-ink-muted">This replaces the {formatNumber(typedConsumed)} L typed in Fuel Consumed.</span>
              )}
              {derived.fuelCostTotal !== undefined && (
                <span className="text-body text-ink">
                  Total cost: <strong>{formatNumber(derived.fuelCostTotal)}</strong>
                  <span className="text-ink-muted">
                    {" "}({formatNumber(Number(values.fuelAddedLiters))} L × {formatNumber(Number(values.fuelCostPerLiter))})
                  </span>
                </span>
              )}
            </div>
          )}
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

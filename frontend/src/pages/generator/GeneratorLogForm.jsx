import { useEffect, useState } from "react";
import Modal from "../../components/modals/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import { generatorService } from "../../services/generatorService";
import { extractErrorMessage } from "./GeneratorForm";
import { computeFuelFigures, closingExceedsAvailable } from "../../utils/fuelFigures";
import { formatNumber } from "../../utils/formatNumber";
import { formatDate } from "../../utils/formatDate";

const BLANK = {
  generatorId: "",
  date: "",
  hoursRun: "",
  meterReadingHours: "",
  openingFuelLiters: "",
  fuelAddedLiters: "",
  fuelReadingLiters: "",
  closingFuelLiters: "", // typed only when editing; when adding, it is worked out from the reading
  fuelCostPerLiter: "",
  fuelVendor: "",
  reason: "",
  notes: "",
};

// Typed numbers that must be 0 or more.
const NUMBER_FIELDS = [
  ["meterReadingHours", "Meter reading"],
  ["openingFuelLiters", "Opening fuel"],
  ["fuelAddedLiters", "Fuel added"],
  ["fuelReadingLiters", "Fuel reading"],
  ["closingFuelLiters", "Closing fuel"],
  ["fuelCostPerLiter", "Price per litre"],
];

const str = (v) => (v === undefined || v === null ? "" : String(v));

// A stored log -> the form's string values, for editing it.
export function toEditValues(log) {
  return {
    ...BLANK,
    generatorId: log.generator?._id ?? log.generator ?? "",
    date: log.date ? String(log.date).slice(0, 10) : "",
    hoursRun: str(log.hoursRun),
    meterReadingHours: str(log.meterReadingHours),
    openingFuelLiters: str(log.openingFuelLiters),
    fuelAddedLiters: log.fuelAddedLiters > 0 ? str(log.fuelAddedLiters) : "",
    closingFuelLiters: str(log.closingFuelLiters),
    fuelCostPerLiter: str(log.fuelCostPerLiter),
    fuelVendor: str(log.fuelVendor),
    reason: str(log.reason),
    notes: str(log.notes),
  };
}

// Form values -> the PATCH body. Unlike adding, a blank optional field is sent
// as null, because on an edit blank means "clear it" (the entry may have held a
// wrong value that has to go). Fuel consumed and total cost are left out: the
// server recalculates them.
export function toUpdatePayload(values) {
  const payload = { hoursRun: Number(values.hoursRun) };
  if (values.date) payload.date = values.date;
  for (const key of PAYLOAD_NUMBERS) payload[key] = values[key] !== "" ? Number(values[key]) : null;
  for (const key of ["fuelVendor", "reason", "notes"]) payload[key] = values[key].trim() || null;
  return payload;
}

// Numbers sent to the server. The typed fuel reading is not one of them:
// what is sent is the closing fuel worked out from it (reading + fuel added).
const PAYLOAD_NUMBERS = ["meterReadingHours", "openingFuelLiters", "fuelAddedLiters", "closingFuelLiters", "fuelCostPerLiter"];

// Blank optional fields are left out so the backend's defaults apply
// (date: now, fuel fields: 0). Fuel consumed and total cost are worked out
// by the server when the readings and price are given.
export function toPayload(values) {
  const payload = { generatorId: values.generatorId, hoursRun: Number(values.hoursRun) };
  if (values.date) payload.date = values.date;
  for (const key of PAYLOAD_NUMBERS) {
    if (values[key] !== "") payload[key] = Number(values[key]);
  }
  if (values.fuelVendor.trim()) payload.fuelVendor = values.fuelVendor.trim();
  if (values.reason.trim()) payload.reason = values.reason.trim();
  if (values.notes.trim()) payload.notes = values.notes.trim();
  return payload;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Create modal for a log entry. Each entry is a reading: the meter, the fuel
 * gauge reading taken BEFORE any fuel is poured in, and the fuel added since
 * the last entry. Closing fuel is not typed: it is the gauge reading plus the
 * fuel added. Hours run and opening fuel are not typed either; they come
 * from the previous entry for the same generator (hours = meter now minus
 * meter then, opening fuel = the previous closing fuel). When there is no
 * previous entry to work from, those two fields become normal inputs.
 *
 * `generatorOptions` is [{ value, label }]; `defaultGeneratorId` preselects
 * one. `onSaved(log)` fires with the created record after a successful post.
 */
export default function GeneratorLogForm({ open, onClose, onSaved, generatorOptions, defaultGeneratorId, log = null }) {
  const isEdit = Boolean(log);
  const [values, setValues] = useState(BLANK);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);
  // status: "idle" (no generator chosen) | "loading" | "ready" | "error"; log is null when there is none.
  const [last, setLast] = useState({ status: "idle", log: null });

  useEffect(() => {
    if (open) {
      setValues(log ? toEditValues(log) : { ...BLANK, generatorId: defaultGeneratorId || "" });
      setFieldErrors({});
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Look up the previous entry (newest first) whenever the generator changes.
  useEffect(() => {
    // Editing works on the stored figures directly, so there is no previous entry to look up.
    if (!open || !values.generatorId || isEdit) {
      setLast({ status: "idle", log: null });
      return undefined;
    }
    let cancelled = false;
    setLast({ status: "loading", log: null });
    generatorService
      .listLogs({ generatorId: values.generatorId, pageSize: 1 })
      .then(({ items }) => !cancelled && setLast({ status: "ready", log: items[0] ?? null }))
      .catch(() => !cancelled && setLast({ status: "error", log: null }));
    return () => {
      cancelled = true;
    };
  }, [open, values.generatorId, isEdit]);

  const setField = (key) => (eventOrValue) => {
    const value = eventOrValue?.target ? eventOrValue.target.value : eventOrValue;
    setValues((v) => ({ ...v, [key]: value }));
    // An error on a field goes away as soon as the person changes it; the rules run again on save.
    setFieldErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const prev = last.log;
  const hoursFromMeter = prev?.meterReadingHours != null;
  const openingFromPrev = prev?.closingFuelLiters != null;

  const meterNow = values.meterReadingHours !== "" ? Number(values.meterReadingHours) : null;
  const autoHours = hoursFromMeter && meterNow !== null && meterNow >= prev.meterReadingHours ? round2(meterNow - prev.meterReadingHours) : null;

  // Closing fuel = the gauge reading (taken before refuelling) + the fuel added.
  const closingFuel = values.fuelReadingLiters !== "" ? round2(Number(values.fuelReadingLiters) + (Number(values.fuelAddedLiters) || 0)) : null;

  // The values the entry is saved with: calculated where a previous entry allows it, typed otherwise.
  const effective = {
    ...values,
    hoursRun: hoursFromMeter ? (autoHours === null ? "" : String(autoHours)) : values.hoursRun,
    openingFuelLiters: openingFromPrev ? String(prev.closingFuelLiters) : values.openingFuelLiters,
    closingFuelLiters: isEdit ? values.closingFuelLiters : closingFuel === null ? "" : String(closingFuel),
  };

  // What the server will work out on save, shown before the person submits.
  const derived = computeFuelFigures(effective);
  const closingTooHigh = closingExceedsAvailable(effective);
  const consumed = closingTooHigh ? undefined : derived.fuelConsumedLiters;
  const showPreview = closingTooHigh || consumed !== undefined || derived.fuelCostTotal !== undefined;

  const validate = () => {
    const next = {};
    if (!values.generatorId) next.generatorId = "Generator is required";

    if (hoursFromMeter) {
      if (meterNow === null) next.meterReadingHours = "Enter the meter reading to work out the hours run";
      else if (meterNow < prev.meterReadingHours) {
        next.meterReadingHours = `Meter reading is lower than the last entry (${formatNumber(prev.meterReadingHours)} h on ${formatDate(prev.date)})`;
      }
    } else if (values.hoursRun === "" || Number(values.hoursRun) < 0) {
      next.hoursRun = "Hours run is required and must be 0 or more";
    }

    if (prev && values.date && values.date < String(prev.date).slice(0, 10)) {
      next.date = `Date is before the last entry (${formatDate(prev.date)})`;
    }

    for (const [key, label] of NUMBER_FIELDS) {
      if (!next[key] && values[key] !== "" && !(Number(values[key]) >= 0)) next[key] = `${label} must be 0 or more`;
    }
    // Same two rules the server enforces on POST /generator/logs.
    const closingKey = isEdit ? "closingFuelLiters" : "fuelReadingLiters";
    if (!next[closingKey] && closingExceedsAvailable(effective)) {
      next[closingKey] = isEdit
        ? "Closing fuel cannot be more than opening plus fuel added"
        : "Fuel reading is higher than the opening fuel. Enter any fuel poured in under Fuel Added.";
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
      const saved = isEdit
        ? await generatorService.updateLog(log._id, toUpdatePayload(effective))
        : await generatorService.createLog(toPayload(effective));
      onSaved(saved);
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // When editing, the entry's generator can't be changed, but it must still show up in the (disabled) select.
  const selectOptions =
    isEdit && !generatorOptions.some((o) => o.value === values.generatorId)
      ? [...generatorOptions, { value: values.generatorId, label: log.generator?.tag ?? "Generator" }]
      : generatorOptions;

  let lastEntryNote = null;
  if (isEdit) lastEntryNote = `Editing the entry from ${formatDate(log.date)}. Entries recorded after it are not recalculated.`;
  else if (last.status === "loading") lastEntryNote = "Checking the last entry for this generator…";
  else if (last.status === "error") lastEntryNote = "Couldn't load the last entry, so enter hours run and opening fuel by hand.";
  else if (last.status === "ready" && !prev) lastEntryNote = "First entry for this generator: enter the hours run and opening fuel by hand.";
  else if (last.status === "ready") {
    const parts = [];
    if (hoursFromMeter) parts.push(`meter ${formatNumber(prev.meterReadingHours)} h`);
    if (openingFromPrev) parts.push(`closing fuel ${formatNumber(prev.closingFuelLiters)} L`);
    lastEntryNote = parts.length
      ? `Last entry ${formatDate(prev.date)}: ${parts.join(", ")}. Hours run and opening fuel are worked out from it.`
      : `Last entry ${formatDate(prev.date)} has no meter or fuel reading, so enter hours run and opening fuel by hand.`;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Log Entry" : "Add Log Entry"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Add Log"}
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
            options={selectOptions}
            placeholder="Select a generator"
            disabled={isEdit}
            error={fieldErrors.generatorId}
          />
          <Input id="log-date" label="Date" type="date" value={values.date} onChange={setField("date")} error={fieldErrors.date} />

          {lastEntryNote && (
            <p id="log-last-entry" aria-live="polite" className="sm:col-span-2 text-helper text-ink-muted rounded-md bg-surface-subtle px-3 py-2">
              {lastEntryNote}
            </p>
          )}

          <Input
            id="log-meterReadingHours"
            label="Meter Reading (hours)"
            type="number"
            min="0"
            step="0.1"
            required={hoursFromMeter}
            value={values.meterReadingHours}
            onChange={setField("meterReadingHours")}
            error={fieldErrors.meterReadingHours}
          />
          {hoursFromMeter ? (
            <Input
              id="log-hoursRun"
              label="Hours Run (calculated)"
              disabled
              value={autoHours === null ? "" : formatNumber(autoHours)}
              placeholder="Enter the meter reading"
              helperText={`Meter reading minus ${formatNumber(prev.meterReadingHours)} h from the last entry`}
              error={fieldErrors.hoursRun}
            />
          ) : (
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
          )}

          {openingFromPrev ? (
            <Input
              id="log-openingFuelLiters"
              label="Opening Fuel (L)"
              disabled
              value={formatNumber(prev.closingFuelLiters)}
              helperText="Closing fuel of the last entry"
            />
          ) : (
            <Input id="log-openingFuelLiters" label="Opening Fuel (L)" type="number" min="0" value={values.openingFuelLiters} onChange={setField("openingFuelLiters")} error={fieldErrors.openingFuelLiters} />
          )}
          {isEdit ? (
            <Input id="log-closingFuelLiters" label="Closing Fuel (L)" type="number" min="0" value={values.closingFuelLiters} onChange={setField("closingFuelLiters")} error={fieldErrors.closingFuelLiters} />
          ) : (
            <Input
              id="log-fuelReadingLiters"
              label="Fuel Reading (L)"
              type="number"
              min="0"
              value={values.fuelReadingLiters}
              onChange={setField("fuelReadingLiters")}
              helperText="Gauge level before any fuel is added"
              error={fieldErrors.fuelReadingLiters}
            />
          )}

          <Input
            id="log-fuelAddedLiters"
            label={prev ? "Fuel Added Since Last Entry (L)" : "Fuel Added (L)"}
            type="number"
            min="0"
            value={values.fuelAddedLiters}
            onChange={setField("fuelAddedLiters")}
            helperText={prev ? "Litres poured in after the last entry. Leave empty if none." : undefined}
            error={fieldErrors.fuelAddedLiters}
          />
          {!isEdit && (
            <Input
              id="log-closingFuelLiters"
              label="Closing Fuel (L)"
              disabled
              value={closingFuel === null ? "" : formatNumber(closingFuel)}
              placeholder="Enter the fuel reading"
              helperText="Fuel reading + fuel added"
            />
          )}
          <Input id="log-fuelCostPerLiter" label="Price per Litre" type="number" min="0" step="0.01" value={values.fuelCostPerLiter} onChange={setField("fuelCostPerLiter")} error={fieldErrors.fuelCostPerLiter} />

          <Input id="log-fuelVendor" label="Fuel Vendor" value={values.fuelVendor} onChange={setField("fuelVendor")} placeholder="e.g. PSO Pump" />
          <Input id="log-reason" label="Reason" value={values.reason} onChange={setField("reason")} placeholder="e.g. power outage" />

          {showPreview && (
            <div id="log-fuel-preview" aria-live="polite" className="sm:col-span-2 rounded-md border border-border bg-surface-subtle px-3 py-2.5 flex flex-col gap-1">
              <span className="text-helper font-semibold text-ink-secondary uppercase tracking-wide">Calculated on save</span>
              {closingTooHigh && (
                <span className="text-body text-status-error">
                  {isEdit
                    ? "Closing fuel is higher than opening plus fuel added, so consumption can't be worked out."
                    : "The fuel reading is higher than the opening fuel, so consumption can't be worked out. The gauge is read before fuel is added; enter what was poured in under Fuel Added."}
                </span>
              )}
              {consumed !== undefined && (
                <span className="text-body text-ink">
                  Fuel consumed: <strong>{formatNumber(consumed)} L</strong>
                  <span className="text-ink-muted">
                    {" "}({formatNumber(Number(effective.openingFuelLiters))} opening + {formatNumber(Number(effective.fuelAddedLiters) || 0)} added − {formatNumber(Number(effective.closingFuelLiters))} closing)
                  </span>
                </span>
              )}
              {derived.fuelCostTotal !== undefined && (
                <span className="text-body text-ink">
                  Total cost: <strong>{formatNumber(derived.fuelCostTotal)}</strong>
                  <span className="text-ink-muted">
                    {" "}({formatNumber(Number(effective.fuelAddedLiters))} L added × {formatNumber(Number(effective.fuelCostPerLiter))} per litre)
                  </span>
                </span>
              )}
            </div>
          )}
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

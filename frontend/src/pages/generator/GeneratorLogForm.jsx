import { useEffect, useState } from "react";
import Modal from "../../components/modals/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import { generatorService } from "../../services/generatorService";
import { extractErrorMessage } from "./GeneratorForm";
import { computeFuelFigures, closingExceedsAvailable, GAUGE_MARKS, gaugeToLiters } from "../../utils/fuelFigures";
import { formatNumber } from "../../utils/formatNumber";
import { formatDate, todayDateValue } from "../../utils/formatDate";
import { fuelUnit } from "../../utils/fuelUnit";
import HoursMinutesInput from "../../components/common/HoursMinutesInput";
import DatePicker from "../../components/common/DatePicker";
import { formatHoursMinutes } from "../../utils/hoursMinutes";

const BLANK = {
  generatorId: "",
  date: "",
  hoursRun: "",
  meterReadingHours: "",
  openingFuelLiters: "",
  openingFuelGaugeReading: "", // needle-gauge mark, gauge-measurement generators only
  fuelAddedLiters: "",
  fuelReadingLiters: "",
  fuelGaugeReading: "", // needle-gauge mark, gauge-measurement generators only
  closingFuelLiters: "", // typed only when editing; when adding, it is worked out from the reading
  fuelCostPerLiter: "",
  fuelVendor: "",
  reason: "",
  notes: "",
};

// Typed numbers that must be 0 or more. fuelCostPerLiter's label depends on
// the generator's fuel unit (litres vs kg), so it takes a function.
const NUMBER_FIELDS = [
  ["meterReadingHours", () => "Meter reading"],
  ["openingFuelLiters", () => "Opening fuel"],
  ["fuelAddedLiters", () => "Fuel added"],
  ["fuelReadingLiters", () => "Fuel reading"],
  ["closingFuelLiters", () => "Closing fuel"],
  ["fuelCostPerLiter", (unit) => `Price per ${unit}`],
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
    openingFuelGaugeReading: str(log.openingFuelGaugeReading),
    fuelAddedLiters: log.fuelAddedLiters > 0 ? str(log.fuelAddedLiters) : "",
    fuelGaugeReading: str(log.fuelGaugeReading),
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
  for (const key of GAUGE_MARK_FIELDS) payload[key] = values[key] !== "" ? values[key] : null;
  for (const key of ["fuelVendor", "reason", "notes"]) payload[key] = values[key].trim() || null;
  return payload;
}

// Numbers sent to the server. The typed fuel reading is not one of them:
// what is sent is the closing fuel worked out from it (reading + fuel added).
const PAYLOAD_NUMBERS = ["meterReadingHours", "openingFuelLiters", "fuelAddedLiters", "closingFuelLiters", "fuelCostPerLiter"];

// The needle-gauge marks a tank-level reading was taken at, sent alongside
// the converted liters above (gauge-measurement generators only).
const GAUGE_MARK_FIELDS = ["openingFuelGaugeReading", "fuelGaugeReading"];

// Blank optional fields are left out so the backend's defaults apply
// (date: now, fuel fields: 0). Fuel consumed and total cost are worked out
// by the server when the readings and price are given.
export function toPayload(values) {
  const payload = { generatorId: values.generatorId, hoursRun: Number(values.hoursRun) };
  if (values.date) payload.date = values.date;
  for (const key of PAYLOAD_NUMBERS) {
    if (values[key] !== "") payload[key] = Number(values[key]);
  }
  for (const key of GAUGE_MARK_FIELDS) {
    if (values[key] !== "") payload[key] = values[key];
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
 * `generatorOptions` is [{ value, label, fuelType, fuelMeasurementType, fuelTankCapacityLiters }];
 * `defaultGeneratorId` preselects one. `onSaved(log)` fires with the created
 * record after a successful post.
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
      setValues(log ? toEditValues(log) : { ...BLANK, generatorId: defaultGeneratorId || "", date: todayDateValue() });
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

  // The selected generator decides the unit shown (L or kg) and whether fuel
  // level is read off a needle gauge or typed as a precise number. Editing
  // works off the stored log's own generator (populated by the API, so it
  // carries fuelMeasurementType/fuelTankCapacityLiters too); adding looks it
  // up in the options list the page already fetched.
  const selectedGenerator = isEdit ? log.generator : generatorOptions.find((o) => o.value === values.generatorId);
  const selectedFuelType = selectedGenerator?.fuelType;
  const unit = fuelUnit(selectedFuelType);
  const isGauge = selectedGenerator?.fuelMeasurementType === "gauge";
  const tankCapacity = selectedGenerator?.fuelTankCapacityLiters;
  const hasCapacity = Number(tankCapacity) > 0;

  const prev = last.log;
  const hoursFromMeter = prev?.meterReadingHours != null;
  const openingFromPrev = prev?.closingFuelLiters != null;

  const meterNow = values.meterReadingHours !== "" ? Number(values.meterReadingHours) : null;
  const autoHours = hoursFromMeter && meterNow !== null && meterNow >= prev.meterReadingHours ? round2(meterNow - prev.meterReadingHours) : null;

  // On a gauge generator, a tank-level reading is picked as a quarter mark
  // (E/¼/½/¾/F) and converted to an amount with the tank capacity, instead of
  // typed as a precise number. Editing keeps using the select only when the
  // entry already has a stored mark — an older entry recorded before this
  // field existed falls back to the same free-number input a digital
  // generator uses, so it stays editable even without a mark. Either select
  // needs a known tank capacity to convert from; without one, fuel-level
  // entry is disabled rather than silently falling back to free numbers.
  const openingMarkStored = isEdit && Boolean(log.openingFuelGaugeReading);
  const wouldUseOpeningGauge = isGauge && !openingFromPrev && (!isEdit || openingMarkStored);
  const useOpeningGaugeSelect = wouldUseOpeningGauge && hasCapacity;
  const openingGaugeBlocked = wouldUseOpeningGauge && !hasCapacity;

  const readingMarkStored = isEdit && Boolean(log.fuelGaugeReading);
  const wouldUseReadingGauge = isGauge && (!isEdit || readingMarkStored);
  const useReadingGaugeSelect = wouldUseReadingGauge && hasCapacity;
  const readingGaugeBlocked = wouldUseReadingGauge && !hasCapacity;

  const missingCapacityNotice = openingGaugeBlocked || readingGaugeBlocked;

  const openingMarkLiters = useOpeningGaugeSelect && values.openingFuelGaugeReading ? gaugeToLiters(values.openingFuelGaugeReading, tankCapacity) : null;
  const readingMarkLiters = useReadingGaugeSelect && values.fuelGaugeReading ? gaugeToLiters(values.fuelGaugeReading, tankCapacity) : null;

  // Closing fuel = the reading taken before refuelling (typed, or a gauge
  // mark converted to an amount) + the fuel added. It's calculated (not
  // typed directly) whenever adding a new entry, or editing one whose
  // reading is a gauge mark; a typed edit of a legacy/digital entry keeps
  // its own closingFuelLiters input instead.
  const closingIsCalculated = !isEdit || useReadingGaugeSelect;
  const closingFuel = useReadingGaugeSelect
    ? readingMarkLiters === null
      ? null
      : round2(readingMarkLiters + (Number(values.fuelAddedLiters) || 0))
    : !isEdit && values.fuelReadingLiters !== ""
      ? round2(Number(values.fuelReadingLiters) + (Number(values.fuelAddedLiters) || 0))
      : null;

  // The values the entry is saved with: calculated where a previous entry or
  // a gauge mark allows it, typed otherwise.
  const effective = {
    ...values,
    hoursRun: hoursFromMeter ? (autoHours === null ? "" : String(autoHours)) : values.hoursRun,
    openingFuelLiters: openingFromPrev
      ? String(prev.closingFuelLiters)
      : useOpeningGaugeSelect
        ? openingMarkLiters === null
          ? ""
          : String(openingMarkLiters)
        : values.openingFuelLiters,
    closingFuelLiters: closingIsCalculated ? (closingFuel === null ? "" : String(closingFuel)) : values.closingFuelLiters,
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

    for (const [key, labelFor] of NUMBER_FIELDS) {
      if (!next[key] && values[key] !== "" && !(Number(values[key]) >= 0)) next[key] = `${labelFor(unit)} must be 0 or more`;
    }
    // Same two rules the server enforces on POST /generator/logs. A gauge
    // mark is only a quarter-tank estimate, so it's surfaced as a warning in
    // the preview below rather than blocking submission the way a precise
    // typed reading does.
    const closingKey = isEdit ? "closingFuelLiters" : "fuelReadingLiters";
    if (!useReadingGaugeSelect && !next[closingKey] && closingExceedsAvailable(effective)) {
      next[closingKey] = isEdit
        ? "Closing fuel cannot be more than opening plus fuel added"
        : "Fuel reading is higher than the opening fuel. Enter any fuel poured in under Fuel Added.";
    }
    if (!next.fuelCostPerLiter && values.fuelCostPerLiter !== "" && !(Number(values.fuelAddedLiters) > 0)) {
      next.fuelCostPerLiter = `Enter the ${unit} added to use a price per ${unit}`;
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
    if (openingFromPrev) parts.push(`closing fuel ${formatNumber(prev.closingFuelLiters)} ${unit}`);
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
          <DatePicker id="log-date" label="Date" value={values.date} onChange={setField("date")} error={fieldErrors.date} />

          {lastEntryNote && (
            <p id="log-last-entry" aria-live="polite" className="sm:col-span-2 text-helper text-ink-muted rounded-md bg-surface-subtle px-3 py-2">
              {lastEntryNote}
            </p>
          )}

          <HoursMinutesInput
            id="log-meterReadingHours"
            label="Meter Reading (hours)"
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
              value={autoHours === null ? "" : formatHoursMinutes(autoHours)}
              placeholder="Enter the meter reading"
              helperText={`Meter reading minus ${formatHoursMinutes(prev.meterReadingHours)} from the last entry`}
              error={fieldErrors.hoursRun}
            />
          ) : (
            <HoursMinutesInput
              id="log-hoursRun"
              label="Hours Run"
              required
              value={values.hoursRun}
              onChange={setField("hoursRun")}
              error={fieldErrors.hoursRun}
            />
          )}

          {missingCapacityNotice && (
            <p className="sm:col-span-2 text-helper text-status-warning bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              This generator reads fuel off a needle gauge but has no tank capacity set, so a gauge mark can't be converted to an amount yet. Set a tank capacity on the generator to record fuel level here — hours and the other fields can still be logged.
            </p>
          )}

          {openingFromPrev ? (
            <Input
              id="log-openingFuelLiters"
              label={`Opening Fuel (${unit})`}
              disabled
              value={formatNumber(prev.closingFuelLiters)}
              helperText="Closing fuel of the last entry"
            />
          ) : useOpeningGaugeSelect ? (
            <Select
              id="log-openingFuelGaugeReading"
              label="Opening Fuel (gauge)"
              value={values.openingFuelGaugeReading}
              onChange={setField("openingFuelGaugeReading")}
              options={GAUGE_MARKS}
              placeholder="Select a mark"
              helperText={openingMarkLiters === null ? "Needle position before this entry" : `≈ ${formatNumber(openingMarkLiters)} ${unit}`}
              error={fieldErrors.openingFuelGaugeReading}
            />
          ) : openingGaugeBlocked ? (
            <Input id="log-openingFuelLiters" label={`Opening Fuel (${unit})`} disabled placeholder="Set a tank capacity first" />
          ) : (
            <Input id="log-openingFuelLiters" label={`Opening Fuel (${unit})`} type="number" min="0" value={values.openingFuelLiters} onChange={setField("openingFuelLiters")} error={fieldErrors.openingFuelLiters} />
          )}
          {useReadingGaugeSelect ? (
            <Select
              id="log-fuelGaugeReading"
              label="Fuel Reading (gauge)"
              value={values.fuelGaugeReading}
              onChange={setField("fuelGaugeReading")}
              options={GAUGE_MARKS}
              placeholder="Select a mark"
              helperText={readingMarkLiters === null ? "Needle position before any fuel is added" : `≈ ${formatNumber(readingMarkLiters)} ${unit} before fuel added`}
              error={fieldErrors.fuelGaugeReading}
            />
          ) : readingGaugeBlocked ? (
            <Input id="log-fuelReadingLiters" label={`Fuel Reading (${unit})`} disabled placeholder="Set a tank capacity first" />
          ) : isEdit ? (
            <Input id="log-closingFuelLiters" label={`Closing Fuel (${unit})`} type="number" min="0" value={values.closingFuelLiters} onChange={setField("closingFuelLiters")} error={fieldErrors.closingFuelLiters} />
          ) : (
            <Input
              id="log-fuelReadingLiters"
              label={`Fuel Reading (${unit})`}
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
            label={prev ? `Fuel Added Since Last Entry (${unit})` : `Fuel Added (${unit})`}
            type="number"
            min="0"
            value={values.fuelAddedLiters}
            onChange={setField("fuelAddedLiters")}
            helperText={prev ? `${unit === "kg" ? "Kilograms" : "Litres"} poured in after the last entry. Leave empty if none.` : undefined}
            error={fieldErrors.fuelAddedLiters}
          />
          {closingIsCalculated && (
            <Input
              id="log-closingFuelLiters"
              label={`Closing Fuel (${unit})`}
              disabled
              value={closingFuel === null ? "" : `${useReadingGaugeSelect ? "≈ " : ""}${formatNumber(closingFuel)}`}
              placeholder="Enter the fuel reading"
              helperText={useReadingGaugeSelect ? "Gauge reading (estimate) + fuel added" : "Fuel reading + fuel added"}
            />
          )}
          <Input id="log-fuelCostPerLiter" label={`Price per ${unit === "kg" ? "Kg" : "Litre"}`} type="number" min="0" step="0.01" value={values.fuelCostPerLiter} onChange={setField("fuelCostPerLiter")} error={fieldErrors.fuelCostPerLiter} />

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
                  Fuel consumed: <strong>{formatNumber(consumed)} {unit}</strong>
                  <span className="text-ink-muted">
                    {" "}({formatNumber(Number(effective.openingFuelLiters))} opening + {formatNumber(Number(effective.fuelAddedLiters) || 0)} added − {formatNumber(Number(effective.closingFuelLiters))} closing)
                  </span>
                </span>
              )}
              {derived.fuelCostTotal !== undefined && (
                <span className="text-body text-ink">
                  Total cost: <strong>{formatNumber(derived.fuelCostTotal)}</strong>
                  <span className="text-ink-muted">
                    {" "}({formatNumber(Number(effective.fuelAddedLiters))} {unit} added × {formatNumber(Number(effective.fuelCostPerLiter))} per {unit})
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

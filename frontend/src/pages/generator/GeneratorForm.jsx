import { useEffect, useState } from "react";
import Modal from "../../components/modals/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import { generatorService } from "../../services/generatorService";

const FUEL_TYPE_OPTIONS = [
  { value: "diesel", label: "Diesel" },
  { value: "petrol", label: "Petrol" },
  { value: "gas", label: "Gas" },
];

const STATUS_OPTIONS = [
  { value: "operational", label: "Operational" },
  { value: "under_maintenance", label: "Under Maintenance" },
  { value: "faulty", label: "Faulty" },
  { value: "decommissioned", label: "Decommissioned" },
];

const BLANK = {
  tag: "",
  name: "",
  location: "",
  make: "",
  model: "",
  serialNumber: "",
  capacityKVA: "",
  fuelType: "diesel",
  fuelTankCapacityLiters: "",
  status: "operational",
  installationDate: "",
  notes: "",
};

// A generator record (from the API) -> string-based form field values.
// Exported so it can be unit-tested without mounting the component.
export function toFormValues(generator) {
  if (!generator) return { ...BLANK };
  return {
    tag: generator.tag ?? "",
    name: generator.name ?? "",
    location: generator.location ?? "",
    make: generator.make ?? "",
    model: generator.model ?? "",
    serialNumber: generator.serialNumber ?? "",
    // != null (not !==) deliberately covers both null and undefined, while
    // still keeping 0 — a real reading — instead of falling back to "".
    capacityKVA: generator.capacityKVA != null ? String(generator.capacityKVA) : "",
    fuelType: generator.fuelType ?? "diesel",
    fuelTankCapacityLiters: generator.fuelTankCapacityLiters != null ? String(generator.fuelTankCapacityLiters) : "",
    status: generator.status ?? "operational",
    // <input type="date"> needs "YYYY-MM-DD"; the API gives back a full ISO string.
    installationDate: generator.installationDate ? generator.installationDate.slice(0, 10) : "",
    notes: generator.notes ?? "",
  };
}

// Form field values -> API payload. Blank optional fields are left out
// entirely rather than sent as "", so they don't overwrite existing data
// on an edit with empty strings.
export function toPayload(values) {
  const payload = { tag: values.tag.trim(), name: values.name.trim() };
  const optionalText = ["location", "make", "model", "serialNumber", "notes", "installationDate"];
  for (const key of optionalText) {
    if (values[key]?.trim()) payload[key] = values[key].trim();
  }
  if (values.capacityKVA !== "") payload.capacityKVA = Number(values.capacityKVA);
  if (values.fuelTankCapacityLiters !== "") payload.fuelTankCapacityLiters = Number(values.fuelTankCapacityLiters);
  if (values.fuelType) payload.fuelType = values.fuelType;
  if (values.status) payload.status = values.status;
  return payload;
}

// Pulls a readable message out of an Axios error using the backend's
// { message, details } envelope. `details` is either an array of
// { field, message } (validation) or an object like { tag: "..." } (a
// duplicate-key conflict) — both are folded into one string.
export function extractErrorMessage(err) {
  const data = err?.response?.data;
  if (!data) return err?.message || "Something went wrong. Please try again.";
  if (Array.isArray(data.details) && data.details.length) {
    return data.details.map((d) => d.message || `${d.field}: invalid`).join(" ");
  }
  if (data.details && typeof data.details === "object") {
    return `${data.message} (${Object.keys(data.details).join(", ")})`;
  }
  return data.message || "Something went wrong. Please try again.";
}

/**
 * Create/edit modal for a generator. Pass `generator` to edit an existing
 * one, or omit it (or pass null) to create a new one. `onSaved(generator)`
 * fires with the saved record after a successful create/update.
 */
export default function GeneratorForm({ open, onClose, onSaved, generator }) {
  const isEdit = Boolean(generator);
  const [values, setValues] = useState(() => toFormValues(generator));
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(toFormValues(generator));
      setFieldErrors({});
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, generator]);

  const setField = (key) => (eventOrValue) => {
    const value = eventOrValue?.target ? eventOrValue.target.value : eventOrValue;
    setValues((v) => ({ ...v, [key]: value }));
  };

  const validate = () => {
    const next = {};
    if (!values.tag.trim()) next.tag = "Tag is required";
    if (!values.name.trim()) next.name = "Name is required";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const payload = toPayload(values);
      const saved = isEdit
        ? await generatorService.updateGenerator(generator._id, payload)
        : await generatorService.createGenerator(payload);
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
      title={isEdit ? "Edit Generator" : "Add Generator"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Add Generator"}
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
          <Input id="generator-tag" label="Tag" required value={values.tag} onChange={setField("tag")} error={fieldErrors.tag} placeholder="e.g. GEN-01" />
          <Input id="generator-name" label="Name" required value={values.name} onChange={setField("name")} error={fieldErrors.name} placeholder="e.g. Main Hall Generator" />
          <Input id="generator-location" label="Location" value={values.location} onChange={setField("location")} />
          <Select id="generator-status" label="Status" value={values.status} onChange={setField("status")} options={STATUS_OPTIONS} />
          <Input id="generator-make" label="Make" value={values.make} onChange={setField("make")} />
          <Input id="generator-model" label="Model" value={values.model} onChange={setField("model")} />
          <Input id="generator-serialNumber" label="Serial Number" value={values.serialNumber} onChange={setField("serialNumber")} />
          <Input id="generator-installationDate" label="Installation Date" type="date" value={values.installationDate} onChange={setField("installationDate")} />
          <Select id="generator-fuelType" label="Fuel Type" value={values.fuelType} onChange={setField("fuelType")} options={FUEL_TYPE_OPTIONS} />
          <Input
            id="generator-fuelTankCapacityLiters"
            label="Fuel Tank Capacity (L)"
            type="number"
            min="0"
            value={values.fuelTankCapacityLiters}
            onChange={setField("fuelTankCapacityLiters")}
          />
          <Input id="generator-capacityKVA" label="Capacity (kVA)" type="number" min="0" value={values.capacityKVA} onChange={setField("capacityKVA")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="generator-notes" className="text-body font-medium text-ink-secondary">
            Notes
          </label>
          <textarea
            id="generator-notes"
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

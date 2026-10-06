import { useState } from "react";
import { userService } from "../../services/userService";
import Modal from "../modals/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import { apiErrorMessage } from "../../utils/apiError";

const FORM_ID = "staff-leave-allocation-form";
const TYPES = [
  { key: "casual", label: "Casual days" },
  { key: "sick", label: "Sick days" },
  { key: "annual", label: "Annual days" },
];

const isValidDays = (value) => value !== "" && Number.isInteger(Number(value)) && Number(value) >= 0;

function AllocationForm({ staff, onClose, onSaved }) {
  const current = {
    casual: staff.leaveAllocation?.casual ?? 0,
    sick: staff.leaveAllocation?.sick ?? 0,
    annual: staff.leaveAllocation?.annual ?? 0,
  };
  const [form, setForm] = useState({
    casual: String(current.casual),
    sick: String(current.sick),
    annual: String(current.annual),
  });
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const allValid = TYPES.every(({ key }) => isValidDays(form[key]));
  // Only the types that actually changed are sent, so the others are never touched.
  const changes = {};
  if (allValid) {
    for (const { key } of TYPES) {
      if (Number(form[key]) !== current[key]) changes[key] = Number(form[key]);
    }
  }
  const hasChanges = Object.keys(changes).length > 0;
  const canSubmit = allValid && hasChanges && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setSubmitError("");
    try {
      const updated = await userService.update(staff._id, { leaveAllocation: changes });
      onSaved(updated);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Couldn't save this allocation. Please try again."));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      // Don't let Escape/backdrop/X discard an in-flight save.
      onClose={saving ? undefined : onClose}
      title="Leave allocation"
      description={`Yearly leave days for ${staff.name}. Unpaid leave has no limit.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving} disabled={!canSubmit}>
            Save
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
        <div className="grid gap-4 sm:grid-cols-3">
          {TYPES.map(({ key, label }) => (
            <Input
              key={key}
              label={label}
              type="number"
              name={key}
              id={`staff-leave-${key}`}
              min={0}
              step={1}
              required
              value={form[key]}
              onChange={setField(key)}
              error={form[key] !== "" && !isValidDays(form[key]) ? "Whole days, 0 or more." : undefined}
            />
          ))}
        </div>
        <p className="text-helper text-ink-muted">
          Only the types you change are saved. A later bulk <span className="font-medium">Assign leaves</span> with
          overwrite on can replace these.
        </p>
      </form>
    </Modal>
  );
}

/**
 * Sets one staff member's yearly casual / sick / annual leave days, prefilled with
 * their current allocation. `onSaved` fires with the updated user after a save.
 */
export default function StaffLeaveAllocationDialog({ staff, onClose, onSaved }) {
  if (!staff) return null;
  return <AllocationForm key={staff._id} staff={staff} onClose={onClose} onSaved={onSaved} />;
}

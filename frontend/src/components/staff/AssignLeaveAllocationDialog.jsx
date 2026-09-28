import { useState } from "react";
import { userService } from "../../services/userService";
import Modal from "../modals/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import { apiErrorMessage } from "../../utils/apiError";

const FORM_ID = "assign-leave-allocation-form";

const emptyForm = { casual: "", sick: "", annual: "", overwrite: false };

function AssignForm({ onClose, onDone }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const casual = Number(form.casual);
  const sick = Number(form.sick);
  const annual = Number(form.annual);
  const fieldsFilled = form.casual !== "" && form.sick !== "" && form.annual !== "";
  const fieldsValid =
    Number.isInteger(casual) && casual >= 0 && Number.isInteger(sick) && sick >= 0 && Number.isInteger(annual) && annual >= 0;
  const canSubmit = fieldsFilled && fieldsValid && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setSubmitError("");
    try {
      const result = await userService.assignLeaveAllocationToAll({
        casual,
        sick,
        annual,
        overwrite: form.overwrite,
      });
      onDone(result);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Couldn't apply this allocation. Please try again."));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      // Don't let Escape/backdrop/X discard an in-flight save.
      onClose={saving ? undefined : onClose}
      title="Assign leaves to all staff"
      description="Sets the yearly leave allocation for every active account in one go."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving} disabled={!canSubmit}>
            Apply
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
          <Input
            label="Casual days"
            type="number"
            name="casual"
            id="assign-leave-casual"
            min={0}
            step={1}
            required
            value={form.casual}
            onChange={setField("casual")}
          />
          <Input
            label="Sick days"
            type="number"
            name="sick"
            id="assign-leave-sick"
            min={0}
            step={1}
            required
            value={form.sick}
            onChange={setField("sick")}
          />
          <Input
            label="Annual days"
            type="number"
            name="annual"
            id="assign-leave-annual"
            min={0}
            step={1}
            required
            value={form.annual}
            onChange={setField("annual")}
          />
        </div>
        <label className="flex items-start gap-2 text-body text-ink-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            id="assign-leave-overwrite"
            checked={form.overwrite}
            onChange={(e) => setForm((f) => ({ ...f, overwrite: e.target.checked }))}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
          />
          <span>
            Overwrite existing allocations
            <span className="block text-helper text-ink-muted">
              {form.overwrite
                ? "Replaces every active account's allocation, even ones already set individually."
                : "Only fills in accounts that don't have an allocation set yet — anyone already set individually is left alone."}
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}

/**
 * Bulk-sets casual/sick/annual leave days for every active staff account.
 * `onDone` fires with { matched, modified } after a successful apply (the
 * caller closes and can show the counts).
 */
export default function AssignLeaveAllocationDialog({ open, onClose, onDone }) {
  if (!open) return null;
  return <AssignForm onClose={onClose} onDone={onDone} />;
}

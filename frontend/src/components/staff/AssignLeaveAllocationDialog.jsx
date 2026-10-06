import { useEffect, useState } from "react";
import { userService } from "../../services/userService";
import { designationService } from "../../services/designationService";
import Modal from "../modals/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import { apiErrorMessage } from "../../utils/apiError";

const FORM_ID = "assign-leave-allocation-form";

const emptyForm = { casual: "", sick: "", annual: "", overwrite: false, designationId: "" };

// Every designation, inactive ones included: people who still hold a deactivated
// designation need leave too. If the list can't load, "All active staff" still works.
function useDesignations() {
  const [state, setState] = useState({ items: [], failed: false });
  useEffect(() => {
    let cancelled = false;
    designationService
      .list()
      .then((items) => {
        if (!cancelled) setState({ items, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ items: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

function AssignForm({ onClose, onDone }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const designations = useDesignations();

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const target = designations.items.find((d) => d._id === form.designationId);
  const targetPhrase = target ? `every active ${target.name}` : "every active account";
  const applyToOptions = [
    { value: "", label: "All active staff" },
    ...designations.items.map((d) => ({ value: d._id, label: d.isActive ? d.name : `${d.name} (inactive)` })),
  ];

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
        designationId: form.designationId || undefined,
      });
      onDone(result, target?.name);
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
      title="Assign leaves"
      description="Sets the yearly leave allocation for all active staff, or only for one designation, in one go."
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
        <Select
          label="Apply to"
          name="designationId"
          id="assign-leave-apply-to"
          value={form.designationId}
          onChange={setField("designationId")}
          options={applyToOptions}
          helperText={
            designations.failed
              ? "Couldn't load designations, so this can only apply to all active staff right now."
              : target
                ? `Only active staff with the ${target.name} designation.`
                : "Every active staff account."
          }
        />
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
                ? `Replaces the allocation of ${targetPhrase}, even ones already set individually.`
                : `Only fills in ${targetPhrase} that doesn't have an allocation yet — anyone already set is left alone.`}
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}

/**
 * Bulk-sets casual/sick/annual leave days for every active staff account, or
 * only for active staff with one designation ("Apply to"). `onDone` fires with
 * ({ matched, modified }, designationName?) after a successful apply (the
 * caller closes and can show the counts).
 */
export default function AssignLeaveAllocationDialog({ open, onClose, onDone }) {
  if (!open) return null;
  return <AssignForm onClose={onClose} onDone={onDone} />;
}

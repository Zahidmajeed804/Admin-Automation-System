import { useEffect, useState } from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { designationService } from "../../services/designationService";
import { apiErrorMessage } from "../../utils/apiError";
import { formatShiftHours } from "../../utils/designationFormat";
import Modal from "../modals/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import Badge from "../common/Badge";
import Table from "../tables/Table";

const FORM_ID = "designation-form";
// Kept in sync with the range on backend/src/models/Designation.js.
const MIN_SHIFT_HOURS = 1;
const MAX_SHIFT_HOURS = 16;

const emptyForm = { id: null, name: "", shiftHours: "" };

function DesignationsManager({ onClose, onChanged }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], failed: false });
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loading = result.key !== attempt;
  const isEdit = Boolean(form.id);

  useEffect(() => {
    let cancelled = false;
    designationService
      .list()
      .then((items) => {
        if (!cancelled) setResult({ key: attempt, items, failed: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: attempt, items: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const name = form.name.trim();
  const shiftHours = Number(form.shiftHours);
  const errors = {};
  if (!name) errors.name = "Name is required.";
  if (form.shiftHours === "") errors.shiftHours = "Shift length is required.";
  else if (!Number.isFinite(shiftHours) || shiftHours < MIN_SHIFT_HOURS || shiftHours > MAX_SHIFT_HOURS) {
    errors.shiftHours = `Between ${MIN_SHIFT_HOURS} and ${MAX_SHIFT_HOURS} hours.`;
  }
  const hasErrors = Object.keys(errors).length > 0;

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const startEdit = (row) => {
    setForm({ id: row._id, name: row.name, shiftHours: String(row.shiftHours) });
    setSubmitted(false);
    setError("");
    setNotice("");
  };

  const cancelEdit = () => {
    setForm(emptyForm);
    setSubmitted(false);
    setError("");
  };

  const afterChange = (message) => {
    setNotice(message);
    setAttempt((a) => a + 1);
    onChanged?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors || saving) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (isEdit) {
        await designationService.update(form.id, { name, shiftHours });
        afterChange(`${name} updated. Days already clocked out keep the shift they were measured against.`);
      } else {
        await designationService.create({ name, shiftHours });
        afterChange(`${name} added.`);
      }
      setForm(emptyForm);
      setSubmitted(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save this designation. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    setTogglingId(row._id);
    setError("");
    setNotice("");
    try {
      await designationService.update(row._id, { isActive: !row.isActive });
      afterChange(
        row.isActive
          ? `${row.name} deactivated. Staff who already have it keep it; it can't be given to anyone new.`
          : `${row.name} activated.`
      );
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't update this designation. Please try again."));
    } finally {
      setTogglingId(null);
    }
  };

  const columns = [
    { key: "name", header: "Designation", render: (row) => <span className="font-medium text-ink">{row.name}</span> },
    { key: "shiftHours", header: "Shift", render: (row) => formatShiftHours(row.shiftHours) },
    { key: "status", header: "Status", render: (row) => <Badge status={row.isActive ? "active" : "inactive"} /> },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" icon={Pencil} aria-label={`Edit ${row.name}`} onClick={() => startEdit(row)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Power}
            aria-label={row.isActive ? `Deactivate ${row.name}` : `Activate ${row.name}`}
            loading={togglingId === row._id}
            disabled={Boolean(togglingId)}
            onClick={() => toggleActive(row)}
          >
            {row.isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      size="lg"
      title="Designations"
      description="Each designation sets the shift length for the staff who hold it. Work beyond the shift counts as overtime."
      footer={
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="bg-status-errorBg border border-red-200 text-status-error text-body rounded-md px-3 py-2"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="bg-status-successBg border border-green-200 text-status-success text-body rounded-md px-3 py-2"
          >
            {notice}
          </div>
        )}
        <form
          id={FORM_ID}
          onSubmit={handleSubmit}
          noValidate
          className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-start"
        >
          <Input
            label={isEdit ? "Edit designation" : "New designation"}
            name="name"
            id="designation-name"
            autoComplete="off"
            placeholder="e.g. Office Boy"
            value={form.name}
            onChange={setField("name")}
            error={submitted ? errors.name : undefined}
            required
          />
          <Input
            label="Shift (hours)"
            type="number"
            name="shiftHours"
            id="designation-shift-hours"
            min={MIN_SHIFT_HOURS}
            max={MAX_SHIFT_HOURS}
            step={0.5}
            placeholder="8"
            value={form.shiftHours}
            onChange={setField("shiftHours")}
            error={submitted ? errors.shiftHours : undefined}
            required
          />
          <div className="flex items-center gap-2 sm:pt-7">
            <Button type="submit" form={FORM_ID} icon={isEdit ? undefined : Plus} loading={saving} disabled={saving}>
              {isEdit ? "Save" : "Add"}
            </Button>
            {isEdit && (
              <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </form>
        <Table
          columns={columns}
          data={result.items}
          keyField="_id"
          loading={loading}
          error={!loading && result.failed}
          onRetry={() => setAttempt((a) => a + 1)}
          emptyTitle="No designations yet"
          emptyDescription="Add one above, e.g. Office Boy with a 9-hour shift."
        />
      </div>
    </Modal>
  );
}

/**
 * Admin dialog to add, rename, re-time and (de)activate designations.
 * `onChanged` fires after every successful change so the caller can refresh
 * anything that shows designation names (e.g. the staff table).
 */
export default function DesignationsDialog({ open, onClose, onChanged }) {
  if (!open) return null;
  return <DesignationsManager onClose={onClose} onChanged={onChanged} />;
}

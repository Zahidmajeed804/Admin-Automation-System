import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { userService } from "../../services/userService";
import { designationService } from "../../services/designationService";
import Modal from "../modals/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import { apiErrorMessage } from "../../utils/apiError";
import { formatShiftHours } from "../../utils/designationFormat";
import { isValidPhone } from "../../utils/phone";

const FORM_ID = "staff-form";

const emptyForm = {
  name: "",
  email: "",
  employeeId: "",
  password: "",
  phone: "",
  department: "",
  designationId: "",
};

const designationOption = (d) => ({
  value: d._id,
  label: `${d.name} (${formatShiftHours(d.shiftHours)} shift)${d.isActive ? "" : " — inactive"}`,
});

// Active designations to pick from, plus the person's current one if it has since been
// deactivated, so editing someone doesn't silently drop it. Falls back to that current
// one alone if the list can't be loaded.
function useDesignationOptions(current) {
  const [state, setState] = useState({ items: [], failed: false });

  useEffect(() => {
    let cancelled = false;
    designationService
      .list({ status: "active" })
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

  const items = [...state.items];
  if (current?._id && !items.some((d) => d._id === current._id)) items.push(current);
  return {
    options: [{ value: "", label: "No designation (default shift)" }, ...items.map(designationOption)],
    failed: state.failed,
  };
}

const serverMessage = (err) => apiErrorMessage(err, "Couldn't save this staff member. Please try again.");

function StaffForm({ staff, onClose, onSaved }) {
  const isEdit = Boolean(staff);
  const [form, setForm] = useState(
    isEdit
      ? {
          name: staff.name || "",
          email: staff.email || "",
          employeeId: staff.employeeId || "",
          password: "",
          phone: staff.phone || "",
          department: staff.department || "",
          designationId: staff.designation?._id || "",
        }
      : emptyForm
  );
  const designations = useDesignationOptions(staff?.designation);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Validation errors only render after a submit attempt - not while the form is still empty
  // or mid-fill, which is when `errors` below is otherwise most likely to be non-empty.
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const name = form.name.trim();
  const email = form.email.trim();
  const employeeId = form.employeeId.trim();
  const phone = form.phone.trim();
  const password = form.password;

  const errors = {};
  if (!name) errors.name = "Name is required.";
  // Email is optional (staff can sign in with their phone or Employee ID); phone is
  // required for new staff. On edit, clearing either removes it.
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!isEdit && !phone) errors.phone = "Phone number is required.";
  else if (phone && !isValidPhone(phone)) errors.phone = "Enter a valid phone number, e.g. 0300 1234567.";
  if (!employeeId) errors.employeeId = "Employee ID is required.";
  else if (!/^[A-Za-z0-9-]{2,20}$/.test(employeeId)) {
    errors.employeeId = "2-20 letters, numbers or hyphens.";
  }
  if (!isEdit) {
    if (!password) errors.password = "Password is required.";
    else if (password.length < 8) errors.password = "At least 8 characters.";
    else if (!/\d/.test(password)) errors.password = "Must contain at least one number.";
  }

  const hasErrors = Object.keys(errors).length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors || saving) return;

    setSaving(true);
    setSubmitError("");
    try {
      const department = form.department.trim();
      if (isEdit) {
        // null clears a designation that was removed in the form.
        const designationId = form.designationId || null;
        await userService.update(staff._id, { name, email, employeeId, phone, department, designationId });
      } else {
        const designationId = form.designationId || undefined;
        await userService.create({ name, email, employeeId, password, phone, department, designationId });
      }
      onSaved();
    } catch (err) {
      setSubmitError(serverMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      // Don't let Escape/backdrop/X discard an in-flight save.
      onClose={saving ? undefined : onClose}
      title={isEdit ? "Edit staff" : "Add staff"}
      description={
        isEdit
          ? "Update this staff member's details."
          : "Creates a login for them. They'll get the staff role by default; change roles from the Roles page."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={saving} disabled={saving}>
            {isEdit ? "Save changes" : "Create staff"}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            name="name"
            id="staff-name"
            autoComplete="off"
            value={form.name}
            onChange={setField("name")}
            error={submitted ? errors.name : undefined}
            required
          />
          <Input
            label="Employee ID"
            name="employeeId"
            id="staff-employee-id"
            autoComplete="off"
            value={form.employeeId}
            onChange={setField("employeeId")}
            error={submitted ? errors.employeeId : undefined}
            placeholder="EMP-001"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone"
            type="tel"
            name="phone"
            id="staff-phone"
            autoComplete="off"
            placeholder="0300 1234567"
            value={form.phone}
            onChange={setField("phone")}
            error={submitted ? errors.phone : undefined}
            helperText="They can sign in with this number or their Employee ID."
            required={!isEdit}
          />
          <Input
            label="Email (optional)"
            type="email"
            name="email"
            id="staff-email"
            autoComplete="off"
            value={form.email}
            onChange={setField("email")}
            error={submitted ? errors.email : undefined}
          />
        </div>
        {!isEdit && (
          <Input
            label="Temporary password"
            type={showPassword ? "text" : "password"}
            name="password"
            id="staff-password"
            autoComplete="new-password"
            value={form.password}
            onChange={setField("password")}
            error={submitted ? errors.password : undefined}
            helperText="At least 8 characters, including a number. They can change it later."
            required
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="text-ink-muted hover:text-ink"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
        )}
        <Input
          label="Department"
          name="department"
          id="staff-department"
          autoComplete="off"
          value={form.department}
          onChange={setField("department")}
        />
        <Select
          label="Designation"
          name="designationId"
          id="staff-designation"
          value={form.designationId}
          onChange={setField("designationId")}
          options={designations.options}
          helperText={
            designations.failed
              ? "Couldn't load designations. You can still save; the current one is kept."
              : "Sets their shift length. Work beyond the shift counts as overtime."
          }
        />
      </form>
    </Modal>
  );
}

/**
 * Add or edit a staff login. Pass `staff` (the row) to edit it, or leave it
 * `null` to create a new one — `open` controls visibility either way.
 * `onSaved` fires after a successful save (the caller closes and refreshes).
 */
export default function StaffFormModal({ open, staff, onClose, onSaved }) {
  if (!open) return null;
  return <StaffForm key={staff?._id || "new"} staff={staff} onClose={onClose} onSaved={onSaved} />;
}

import { useState } from "react";
import { userService } from "../../services/userService";
import Modal from "../modals/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import { apiErrorMessage } from "../../utils/apiError";

const FORM_ID = "staff-form";

const emptyForm = { name: "", email: "", employeeId: "", password: "", phone: "", department: "" };

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
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const name = form.name.trim();
  const email = form.email.trim();
  const employeeId = form.employeeId.trim();
  const password = form.password;

  const errors = {};
  if (!name) errors.name = "Name is required.";
  if (!email) errors.email = "Email is required.";
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!employeeId) errors.employeeId = "Employee ID is required.";
  else if (!/^[A-Za-z0-9-]{2,20}$/.test(employeeId)) {
    errors.employeeId = "2-20 letters, numbers or hyphens.";
  }
  if (!isEdit) {
    if (!password) errors.password = "Password is required.";
    else if (password.length < 8) errors.password = "At least 8 characters.";
    else if (!/\d/.test(password)) errors.password = "Must contain at least one number.";
  }

  const canSave = Object.keys(errors).length === 0 && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setSubmitError("");
    try {
      const phone = form.phone.trim();
      const department = form.department.trim();
      if (isEdit) {
        await userService.update(staff._id, { name, email, employeeId, phone, department });
      } else {
        await userService.create({ name, email, employeeId, password, phone, department });
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
          <Button type="submit" form={FORM_ID} loading={saving} disabled={!canSave}>
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
            value={form.name}
            onChange={setField("name")}
            error={errors.name}
            required
          />
          <Input
            label="Employee ID"
            name="employeeId"
            id="staff-employee-id"
            value={form.employeeId}
            onChange={setField("employeeId")}
            error={errors.employeeId}
            placeholder="EMP-001"
            required
          />
        </div>
        <Input
          label="Email"
          type="email"
          name="email"
          id="staff-email"
          value={form.email}
          onChange={setField("email")}
          error={errors.email}
          required
        />
        {!isEdit && (
          <Input
            label="Temporary password"
            type="password"
            name="password"
            id="staff-password"
            value={form.password}
            onChange={setField("password")}
            error={errors.password}
            helperText="At least 8 characters, including a number. They can change it later."
            required
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone"
            name="phone"
            id="staff-phone"
            value={form.phone}
            onChange={setField("phone")}
          />
          <Input
            label="Department"
            name="department"
            id="staff-department"
            value={form.department}
            onChange={setField("department")}
          />
        </div>
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

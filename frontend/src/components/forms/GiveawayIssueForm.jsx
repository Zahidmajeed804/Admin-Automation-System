import { useState } from "react";
import Input from "../common/Input";
import Select from "../common/Select";
import Button from "../common/Button";
import { departmentOptions } from "../../constants/giveawayOptions";

/**
 * Issue/distribution form. `item` is the giveaway item being issued
 * (already chosen from the table row's "Issue" action).
 */
export default function GiveawayIssueForm({ item, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    employeeName: "",
    department: "",
    eventName: "",
    quantity: "",
    approvedBy: "",
    remarks: "",
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((err) => ({ ...err, [name]: undefined }));
  };

  const validate = () => {
    const err = {};
    if (!form.employeeName.trim()) err.employeeName = "Employee name is required";
    const qty = Number(form.quantity);
    if (!form.quantity || qty <= 0) err.quantity = "Enter a valid quantity";
    else if (qty > item.currentStock) err.quantity = `Only ${item.currentStock} in stock`;
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      itemId: item._id,
      date: form.date,
      employeeName: form.employeeName.trim(),
      department: form.department,
      eventName: form.eventName.trim(),
      quantity: Number(form.quantity),
      approvedBy: form.approvedBy.trim(),
      remarks: form.remarks.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="bg-surface-blue rounded-md px-3.5 py-2.5 text-body text-ink-secondary">
        Issuing <span className="font-medium text-ink">{item.itemName}</span> — current stock:{" "}
        <span className="font-medium text-ink">{item.currentStock}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Date" name="date" type="date" value={form.date} onChange={handleChange} required />
        <Input
          label="Quantity"
          name="quantity"
          type="number"
          min="1"
          value={form.quantity}
          onChange={handleChange}
          error={errors.quantity}
          required
        />
      </div>
      <Input
        label="Employee"
        name="employeeName"
        value={form.employeeName}
        onChange={handleChange}
        error={errors.employeeName}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Department"
          name="department"
          options={departmentOptions}
          placeholder="Select department"
          value={form.department}
          onChange={handleChange}
        />
        <Input label="Event" name="eventName" value={form.eventName} onChange={handleChange} />
      </div>
      <Input label="Approved By" name="approvedBy" value={form.approvedBy} onChange={handleChange} />
      <div className="flex flex-col gap-1.5">
        <label className="text-body font-medium text-ink-secondary">Remarks</label>
        <textarea
          name="remarks"
          rows={3}
          value={form.remarks}
          onChange={handleChange}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      <div className="flex justify-end gap-3 mt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Issue Item
        </Button>
      </div>
    </form>
  );
}

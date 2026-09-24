import { useState } from "react";
import Input from "../common/Input";
import Select from "../common/Select";
import Button from "../common/Button";
import { paymentStatusOptions } from "../../constants/inventoryOptions";

const today = () => new Date().toISOString().slice(0, 10);

/** Records a purchase for one inventory item; increases its balance. */
export default function PurchaseForm({ item, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState({
    quantity: "",
    purchaseAmount: "",
    purchaseDate: today(),
    vendor: item.vendor || "",
    invoiceNumber: "",
    paymentStatus: "Paid",
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((err) => ({ ...err, [name]: undefined }));
  };

  const validate = () => {
    const err = {};
    if (!form.quantity || Number(form.quantity) <= 0) err.quantity = "Enter a valid quantity";
    if (form.purchaseAmount === "" || Number(form.purchaseAmount) < 0) err.purchaseAmount = "Enter a valid amount";
    if (!form.purchaseDate) err.purchaseDate = "Date is required";
    if (!form.vendor.trim()) err.vendor = "Vendor is required";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      item: item._id,
      quantity: Number(form.quantity),
      purchaseAmount: Number(form.purchaseAmount),
      purchaseDate: form.purchaseDate,
      vendor: form.vendor.trim(),
      invoiceNumber: form.invoiceNumber.trim(),
      paymentStatus: form.paymentStatus,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="bg-surface-blue rounded-md px-3.5 py-2.5 text-body text-ink-secondary">
        {item.itemName} — current balance:{" "}
        <span className="font-medium text-ink">
          {item.currentStock} {item.unit}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={`Quantity${item.unit ? ` (${item.unit})` : ""}`}
          name="quantity"
          type="number"
          min="0"
          step="any"
          value={form.quantity}
          onChange={handleChange}
          error={errors.quantity}
          required
        />
        <Input
          label="Total Amount"
          name="purchaseAmount"
          type="number"
          min="0"
          step="0.01"
          value={form.purchaseAmount}
          onChange={handleChange}
          error={errors.purchaseAmount}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Purchase Date"
          name="purchaseDate"
          type="date"
          value={form.purchaseDate}
          onChange={handleChange}
          error={errors.purchaseDate}
          required
        />
        <Input label="Vendor" name="vendor" value={form.vendor} onChange={handleChange} error={errors.vendor} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Invoice #" name="invoiceNumber" value={form.invoiceNumber} onChange={handleChange} />
        <Select
          label="Payment Status"
          name="paymentStatus"
          options={paymentStatusOptions}
          value={form.paymentStatus}
          onChange={handleChange}
        />
      </div>
      <div className="flex justify-end gap-3 mt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Record Purchase
        </Button>
      </div>
    </form>
  );
}

import { useState } from "react";
import Input from "../common/Input";
import Button from "../common/Button";

/** Records consumption of an inventory item; decreases its balance. */
export default function ConsumeForm({ item, onSubmit, onCancel, submitting }) {
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!quantity || qty <= 0) {
      setError("Enter a valid quantity");
      return;
    }
    if (qty > item.currentStock) {
      setError(`Only ${item.currentStock} ${item.unit || ""} in stock`.trim());
      return;
    }
    onSubmit({ quantity: qty, remarks: remarks.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="bg-surface-blue rounded-md px-3.5 py-2.5 text-body text-ink-secondary">
        {item.itemName} — current balance:{" "}
        <span className="font-medium text-ink">
          {item.currentStock} {item.unit}
        </span>
      </div>
      <Input
        label="Quantity Consumed"
        type="number"
        min="0"
        step="any"
        value={quantity}
        onChange={(e) => {
          setQuantity(e.target.value);
          setError("");
        }}
        error={error}
        required
      />
      <Input label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      <div className="flex justify-end gap-3 mt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={submitting}>
          Record Consumption
        </Button>
      </div>
    </form>
  );
}

import { useState } from "react";
import Input from "../common/Input";
import Button from "../common/Button";

export default function StockAdjustForm({ item, mode, onSubmit, onCancel, submitting }) {
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  const isOut = mode === "stock-out";

  const handleSubmit = (e) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!quantity || qty <= 0) {
      setError("Enter a valid quantity");
      return;
    }
    if (isOut && qty > item.currentStock) {
      setError(`Only ${item.currentStock} in stock`);
      return;
    }
    onSubmit({ quantity: qty, remarks: remarks.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="bg-surface-blue rounded-md px-3.5 py-2.5 text-body text-ink-secondary">
        {item.itemName} — current stock: <span className="font-medium text-ink">{item.currentStock}</span>
      </div>
      <Input
        label="Quantity"
        type="number"
        min="1"
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
        <Button type="submit" variant={isOut ? "danger" : "primary"} loading={submitting}>
          {isOut ? "Remove Stock" : "Add Stock"}
        </Button>
      </div>
    </form>
  );
}

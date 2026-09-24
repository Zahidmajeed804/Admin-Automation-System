import { useState, useEffect } from "react";
import Input from "../common/Input";
import Select from "../common/Select";
import Button from "../common/Button";
import { giveawayCategoryOptions } from "../../constants/giveawayOptions";

const emptyForm = {
  itemName: "",
  sku: "",
  category: "",
  unitPrice: "",
  vendor: "",
  openingStock: "",
  minimumStock: "",
};

/**
 * Shared add/edit form for a giveaway item. `initialValues` present means
 * edit mode (SKU + opening stock become read-only, since they can't be
 * changed after creation — stock only moves through stock-in/out/issue).
 */
export default function GiveawayItemForm({ initialValues, onSubmit, onCancel, submitting }) {
  const isEdit = Boolean(initialValues);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialValues) {
      setForm({
        itemName: initialValues.itemName || "",
        sku: initialValues.sku || "",
        category: initialValues.category || "",
        unitPrice: initialValues.unitPrice ?? "",
        vendor: initialValues.vendor || "",
        openingStock: initialValues.openingStock ?? "",
        minimumStock: initialValues.minimumStock ?? "",
      });
    }
  }, [initialValues]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((err) => ({ ...err, [name]: undefined }));
  };

  const validate = () => {
    const err = {};
    if (!form.itemName.trim()) err.itemName = "Item name is required";
    if (!isEdit && !form.sku.trim()) err.sku = "SKU is required";
    if (!form.category) err.category = "Category is required";
    if (form.unitPrice === "" || Number(form.unitPrice) < 0) err.unitPrice = "Enter a valid unit price";
    if (!isEdit && (form.openingStock === "" || Number(form.openingStock) < 0))
      err.openingStock = "Enter a valid opening stock";
    if (form.minimumStock === "" || Number(form.minimumStock) < 0)
      err.minimumStock = "Enter a valid minimum stock";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      itemName: form.itemName.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category,
      unitPrice: Number(form.unitPrice),
      vendor: form.vendor.trim(),
      openingStock: Number(form.openingStock),
      minimumStock: Number(form.minimumStock),
    });
  };

  return (
    <form id="giveaway-item-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Item Name"
        name="itemName"
        value={form.itemName}
        onChange={handleChange}
        error={errors.itemName}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="SKU / Code"
          name="sku"
          value={form.sku}
          onChange={handleChange}
          error={errors.sku}
          disabled={isEdit}
          helperText={isEdit ? "SKU cannot be changed after creation" : undefined}
          required
        />
        <Select
          label="Category"
          name="category"
          options={giveawayCategoryOptions}
          placeholder="Select category"
          value={form.category}
          onChange={handleChange}
          error={errors.category}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Unit Price"
          name="unitPrice"
          type="number"
          step="0.01"
          min="0"
          value={form.unitPrice}
          onChange={handleChange}
          error={errors.unitPrice}
          required
        />
        <Input label="Vendor" name="vendor" value={form.vendor} onChange={handleChange} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Opening Stock"
          name="openingStock"
          type="number"
          min="0"
          value={form.openingStock}
          onChange={handleChange}
          error={errors.openingStock}
          disabled={isEdit}
          helperText={isEdit ? "Use Stock In/Out to adjust balance" : undefined}
          required
        />
        <Input
          label="Minimum Stock"
          name="minimumStock"
          type="number"
          min="0"
          value={form.minimumStock}
          onChange={handleChange}
          error={errors.minimumStock}
          required
        />
      </div>

      <div className="flex justify-end gap-3 mt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {isEdit ? "Save Changes" : "Add Item"}
        </Button>
      </div>
    </form>
  );
}

import { useState, useEffect } from "react";
import Input from "../common/Input";
import Select from "../common/Select";
import Button from "../common/Button";
import { inventoryTypeOptions, inventoryUnitOptions } from "../../constants/inventoryOptions";

const emptyForm = {
  itemName: "",
  type: "",
  unit: "",
  unitCost: "",
  vendor: "",
  openingStock: "",
  minimumStock: "",
};

/**
 * Add/edit form for a grocery or cleaning inventory item. In edit mode the
 * type and balance are locked — balance only moves through purchases and
 * consumption. `readOnly` renders the "View" details modal.
 */
export default function InventoryItemForm({ initialValues, defaultType, readOnly = false, onSubmit, onCancel, submitting }) {
  const isEdit = Boolean(initialValues);
  const [form, setForm] = useState({ ...emptyForm, type: defaultType || "" });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialValues) {
      setForm({
        itemName: initialValues.itemName || "",
        type: initialValues.type || defaultType || "",
        unit: initialValues.unit || "",
        unitCost: initialValues.unitCost ?? "",
        vendor: initialValues.vendor || "",
        openingStock: initialValues.currentStock ?? "",
        minimumStock: initialValues.minimumStock ?? "",
      });
    }
  }, [initialValues, defaultType]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((err) => ({ ...err, [name]: undefined }));
  };

  const validate = () => {
    const err = {};
    if (!form.itemName.trim()) err.itemName = "Item name is required";
    if (!form.type) err.type = "Type is required";
    if (!form.unit) err.unit = "Unit is required";
    if (form.unitCost === "" || Number(form.unitCost) < 0) err.unitCost = "Enter a valid unit cost";
    if (!isEdit && (form.openingStock === "" || Number(form.openingStock) < 0))
      err.openingStock = "Enter a valid opening stock";
    if (form.minimumStock === "" || Number(form.minimumStock) < 0)
      err.minimumStock = "Enter a valid minimum stock";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly || !validate()) return;
    const payload = {
      itemName: form.itemName.trim(),
      type: form.type,
      unit: form.unit,
      unitCost: Number(form.unitCost),
      vendor: form.vendor.trim(),
      minimumStock: Number(form.minimumStock),
    };
    if (!isEdit) payload.openingStock = Number(form.openingStock);
    onSubmit(payload);
  };

  return (
    <form id="inventory-item-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Item Name"
        name="itemName"
        value={form.itemName}
        onChange={handleChange}
        error={errors.itemName}
        disabled={readOnly}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Type"
          name="type"
          options={inventoryTypeOptions}
          placeholder="Select type"
          value={form.type}
          onChange={handleChange}
          error={errors.type}
          disabled={isEdit || readOnly}
          required
        />
        <Select
          label="Unit"
          name="unit"
          options={inventoryUnitOptions}
          placeholder="Select unit"
          value={form.unit}
          onChange={handleChange}
          error={errors.unit}
          disabled={readOnly}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Unit Cost"
          name="unitCost"
          type="number"
          step="0.01"
          min="0"
          value={form.unitCost}
          onChange={handleChange}
          error={errors.unitCost}
          disabled={readOnly}
          required
        />
        <Input label="Vendor" name="vendor" value={form.vendor} onChange={handleChange} disabled={readOnly} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={isEdit ? "Current Balance" : "Opening Stock"}
          name="openingStock"
          type="number"
          min="0"
          value={form.openingStock}
          onChange={handleChange}
          error={errors.openingStock}
          disabled={isEdit}
          helperText={isEdit && !readOnly ? "Use Record Purchase / Consume to adjust balance" : undefined}
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
          disabled={readOnly}
          required
        />
      </div>

      <div className="flex justify-end gap-3 mt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          {readOnly ? "Close" : "Cancel"}
        </Button>
        {!readOnly && (
          <Button type="submit" loading={submitting}>
            {isEdit ? "Save Changes" : "Add Item"}
          </Button>
        )}
      </div>
    </form>
  );
}

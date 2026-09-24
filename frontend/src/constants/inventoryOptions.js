export const inventoryTypeOptions = [
  { value: "grocery", label: "Grocery" },
  { value: "cleaning", label: "Cleaning" },
];

export const inventoryUnitOptions = ["pcs", "kg", "g", "litre", "ml", "pack", "box", "bottle"].map((u) => ({
  value: u,
  label: u,
}));

export const paymentStatusOptions = [
  { value: "Paid", label: "Paid" },
  { value: "Pending", label: "Pending" },
];

// CNG generators are measured in kg; diesel and petrol stay in litres.
export function fuelUnit(fuelType) {
  return fuelType === "cng" ? "kg" : "L";
}

export function fuelUnitWord(fuelType) {
  return fuelType === "cng" ? "kilogram" : "litre";
}

const FUEL_TYPE_LABELS = { diesel: "Diesel", petrol: "Petrol", cng: "CNG" };

export function fuelTypeLabel(fuelType) {
  return FUEL_TYPE_LABELS[fuelType] ?? fuelType ?? "—";
}

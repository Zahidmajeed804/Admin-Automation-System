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

const FUEL_MEASUREMENT_LABELS = { gauge: "Needle Gauge", digital: "Digital Sensor" };

export function fuelMeasurementLabel(fuelMeasurementType) {
  return FUEL_MEASUREMENT_LABELS[fuelMeasurementType] ?? null;
}

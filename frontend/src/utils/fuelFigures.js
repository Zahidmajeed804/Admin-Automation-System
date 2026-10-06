const isGiven = (v) => v !== undefined && v !== null && v !== "";
const round2 = (n) => Math.max(0, Math.round(n * 100) / 100);

/**
 * The fuel figures the server works out when a log is saved. This must stay
 * identical to computeFuelFigures in backend/src/services/generatorService.js,
 * so the preview a person sees matches what gets stored. Accepts the form's
 * string values or numbers; blank ("") counts as not given.
 *
 *   fuelConsumedLiters = opening + added - closing   (needs both readings)
 *   fuelCostTotal      = added x price per litre     (needs a price and litres added)
 */
export function computeFuelFigures({ openingFuelLiters, closingFuelLiters, fuelAddedLiters, fuelCostPerLiter } = {}) {
  const derived = {};
  const added = Number(fuelAddedLiters) || 0;

  if (isGiven(openingFuelLiters) && isGiven(closingFuelLiters)) {
    derived.fuelConsumedLiters = round2(Number(openingFuelLiters) + added - Number(closingFuelLiters));
  }
  if (isGiven(fuelCostPerLiter) && added > 0) {
    derived.fuelCostTotal = round2(added * Number(fuelCostPerLiter));
  }
  return derived;
}

/** True when both readings are given and the tank would end fuller than opening + added. */
export function closingExceedsAvailable({ openingFuelLiters, closingFuelLiters, fuelAddedLiters } = {}) {
  if (!isGiven(openingFuelLiters) || !isGiven(closingFuelLiters)) return false;
  return Number(closingFuelLiters) > Number(openingFuelLiters) + (Number(fuelAddedLiters) || 0);
}

// Quarter marks on a needle gauge, and the fraction of a full tank each one
// represents. Must stay in sync with FUEL_GAUGE_MARKS in
// backend/src/constants/generator.js.
export const GAUGE_MARKS = [
  { value: "E", label: "E — Empty", fraction: 0 },
  { value: "1/4", label: "¼ tank", fraction: 0.25 },
  { value: "1/2", label: "½ tank", fraction: 0.5 },
  { value: "3/4", label: "¾ tank", fraction: 0.75 },
  { value: "F", label: "F — Full", fraction: 1 },
];

/** A gauge mark + a tank capacity -> an amount, or null when either is missing/unknown. */
export function gaugeToLiters(mark, capacity) {
  const entry = GAUGE_MARKS.find((m) => m.value === mark);
  if (!entry || !(Number(capacity) > 0)) return null;
  return round2(entry.fraction * Number(capacity));
}

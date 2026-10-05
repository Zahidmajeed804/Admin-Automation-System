// Single source of truth for generator fuel types, shared by the model and
// the validators so they can't drift out of sync with each other.
export const FUEL_TYPES = ["diesel", "petrol", "CNG"];
export const DEFAULT_FUEL_TYPE = "diesel";

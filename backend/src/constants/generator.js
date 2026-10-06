// Single source of truth for generator fuel types, shared by the model and
// the validators so they can't drift out of sync with each other.
export const FUEL_TYPES = ["diesel", "petrol", "cng"];
export const DEFAULT_FUEL_TYPE = "diesel";

// How a generator's fuel level is read: most generators here have an analog
// needle gauge (quarter marks only, no precise number), while a future
// digital-sensor generator would report a precise liter/kg reading instead.
// Defaults to "gauge" since that's what every generator on site has today.
export const FUEL_MEASUREMENT_TYPES = ["gauge", "digital"];
export const DEFAULT_FUEL_MEASUREMENT_TYPE = "gauge";

// Quarter marks on a needle gauge, and the fraction of a full tank each one
// represents. Kept in sync with frontend/src/utils/fuelFigures.js GAUGE_MARKS.
export const FUEL_GAUGE_MARKS = { E: 0, "1/4": 0.25, "1/2": 0.5, "3/4": 0.75, F: 1 };
export const FUEL_GAUGE_MARK_KEYS = Object.keys(FUEL_GAUGE_MARKS);

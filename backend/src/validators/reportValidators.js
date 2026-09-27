import { query } from "express-validator";
import { runValidation } from "../middleware/runValidation.js";

// Shared by every report that accepts an optional generatorId to scope to
// one generator instead of the whole fleet.
const generatorIdFilter = query("generatorId").optional().isMongoId().withMessage("generatorId must be a valid id");

export const runningHoursReportValidator = [
  generatorIdFilter,
  query("month").optional().matches(/^\d{4}-\d{2}$/).withMessage("month must be in YYYY-MM format"),
  runValidation,
];

// Shared by every report that takes an arbitrary from/to range instead of a
// calendar month (the service resolves the default when either is absent).
const dateRangeFilter = [
  query("from").optional().isISO8601().withMessage("from must be a valid date"),
  query("to").optional().isISO8601().withMessage("to must be a valid date"),
];

export const dieselConsumptionReportValidator = [generatorIdFilter, ...dateRangeFilter, runValidation];

export const fuelCostReportValidator = [
  generatorIdFilter,
  query("month").optional().matches(/^\d{4}-\d{2}$/).withMessage("month must be in YYYY-MM format"),
  runValidation,
];

export const maintenanceCostReportValidator = [generatorIdFilter, ...dateRangeFilter, runValidation];

export const operatingCostReportValidator = [
  generatorIdFilter,
  query("year").optional().isInt({ min: 2000, max: 2100 }).withMessage("year must be a 4-digit year between 2000 and 2100"),
  runValidation,
];

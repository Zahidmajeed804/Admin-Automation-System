import { query } from "express-validator";
import { runValidation } from "../middleware/runValidation.js";

// Shared by every report that accepts an optional employeeId to scope to
// one employee instead of the whole company — same shape as the Generator
// module's generatorIdFilter.
const employeeIdFilter = query("employeeId").optional().isMongoId().withMessage("employeeId must be a valid id");

// Shared by every report that takes an arbitrary from/to range (the service
// resolves the default when either is absent) — same shape as the Generator
// module's dateRangeFilter.
const dateRangeFilter = [
  query("from").optional().isISO8601().withMessage("from must be a valid date"),
  query("to").optional().isISO8601().withMessage("to must be a valid date"),
];

export const attendanceSummaryReportValidator = [employeeIdFilter, ...dateRangeFilter, runValidation];

// Same filters as the view, plus the export format (defaults to csv in the
// controller when omitted).
export const attendanceSummaryExportValidator = [
  employeeIdFilter,
  ...dateRangeFilter,
  query("format").optional().isIn(["csv", "pdf"]).withMessage("format must be one of: csv, pdf"),
  runValidation,
];

export const overtimeSummaryReportValidator = [employeeIdFilter, ...dateRangeFilter, runValidation];

export const overtimeSummaryExportValidator = [
  employeeIdFilter,
  ...dateRangeFilter,
  query("format").optional().isIn(["csv", "pdf"]).withMessage("format must be one of: csv, pdf"),
  runValidation,
];

// Leave usage is scoped to a calendar year, not an arbitrary from/to range —
// same shape as the Generator module's operatingCostReportValidator.
const yearFilter = query("year").optional().isInt({ min: 2000, max: 2100 }).withMessage("year must be a 4-digit year between 2000 and 2100");

export const leaveUsageReportValidator = [employeeIdFilter, yearFilter, runValidation];

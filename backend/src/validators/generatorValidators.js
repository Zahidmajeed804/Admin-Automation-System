import { body, query } from "express-validator";
import { runValidation } from "../middleware/runValidation.js";

// Must stay in sync with the enums on models/Generator.js.
const FUEL_TYPES = ["diesel", "petrol", "gas"];
const STATUSES = ["operational", "under_maintenance", "faulty", "decommissioned"];

const optionalFields = [
  body("location").optional().trim(),
  body("make").optional().trim(),
  body("model").optional().trim(),
  body("serialNumber").optional().trim(),
  body("capacityKVA").optional().isFloat({ min: 0 }).withMessage("capacityKVA must be a non-negative number"),
  body("fuelType").optional().isIn(FUEL_TYPES).withMessage(`fuelType must be one of: ${FUEL_TYPES.join(", ")}`),
  body("fuelTankCapacityLiters")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("fuelTankCapacityLiters must be a non-negative number"),
  body("status").optional().isIn(STATUSES).withMessage(`status must be one of: ${STATUSES.join(", ")}`),
  body("installationDate").optional().isISO8601().withMessage("installationDate must be a valid date"),
  body("notes").optional().trim(),
];

export const createGeneratorValidator = [
  body("tag").trim().notEmpty().withMessage("tag is required"),
  body("name").trim().notEmpty().withMessage("name is required"),
  ...optionalFields,
  runValidation,
];

export const createGeneratorLogValidator = [
  body("generatorId").isMongoId().withMessage("generatorId must be a valid id"),
  body("hoursRun").isFloat({ min: 0 }).withMessage("hoursRun is required and must be a non-negative number"),
  body("date").optional().isISO8601().withMessage("date must be a valid date"),
  body("meterReadingHours").optional().isFloat({ min: 0 }).withMessage("meterReadingHours must be a non-negative number"),
  body("fuelAddedLiters").optional().isFloat({ min: 0 }).withMessage("fuelAddedLiters must be a non-negative number"),
  body("fuelConsumedLiters").optional().isFloat({ min: 0 }).withMessage("fuelConsumedLiters must be a non-negative number"),
  body("openingFuelLiters").optional().isFloat({ min: 0 }).withMessage("openingFuelLiters must be a non-negative number"),
  body("closingFuelLiters")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("closingFuelLiters must be a non-negative number")
    .bail()
    .custom((closing, { req }) => {
      const { openingFuelLiters, fuelAddedLiters } = req.body;
      if (openingFuelLiters === undefined) return true;
      if (Number(closing) > Number(openingFuelLiters) + Number(fuelAddedLiters ?? 0)) {
        throw new Error("closingFuelLiters cannot exceed openingFuelLiters plus fuelAddedLiters");
      }
      return true;
    }),
  body("fuelCostPerLiter")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("fuelCostPerLiter must be a non-negative number")
    .bail()
    .custom((_, { req }) => {
      if (!(Number(req.body.fuelAddedLiters) > 0)) {
        throw new Error("fuelCostPerLiter needs fuelAddedLiters greater than 0");
      }
      return true;
    }),
  body("fuelCostTotal").optional().isFloat({ min: 0 }).withMessage("fuelCostTotal must be a non-negative number"),
  body("fuelVendor").optional().trim(),
  body("reason").optional().trim(),
  body("notes").optional().trim(),
  runValidation,
];

// PATCH /generator/logs/:logId — every field is optional. An optional number or
// text field may be sent as null to clear it; hoursRun and date are required on
// a log, so they can be changed but not cleared. The rules that compare fields
// with each other (closing vs opening + added, price needs fuel added) run in
// generatorService.updateLog, on the merged result, because a partial update
// may only carry one side of the comparison.
export const updateGeneratorLogValidator = [
  body("hoursRun").optional().isFloat({ min: 0 }).withMessage("hoursRun must be a non-negative number"),
  body("date").optional().isISO8601().withMessage("date must be a valid date"),
  ...["meterReadingHours", "fuelAddedLiters", "fuelConsumedLiters", "openingFuelLiters", "closingFuelLiters", "fuelCostPerLiter", "fuelCostTotal"].map((field) =>
    body(field).optional({ nullable: true }).isFloat({ min: 0 }).withMessage(`${field} must be a non-negative number or null`)
  ),
  body("fuelVendor").optional({ nullable: true }).trim(),
  body("reason").optional({ nullable: true }).trim(),
  body("notes").optional({ nullable: true }).trim(),
  runValidation,
];

// Must stay in sync with the enums on models/GeneratorMaintenance.js.
const MAINTENANCE_TYPES = ["scheduled", "unscheduled", "inspection"];

const maintenanceOptionalFields = [
  body("type").optional().isIn(MAINTENANCE_TYPES).withMessage(`type must be one of: ${MAINTENANCE_TYPES.join(", ")}`),
  body("alertThresholdDays").optional().isInt({ min: 0 }).withMessage("alertThresholdDays must be a whole number of days, 0 or more"),
  body("performedBy").optional().trim(),
  body("cost").optional().isFloat({ min: 0 }).withMessage("cost must be a non-negative number"),
  body("partsReplaced").optional().trim(),
  body("notes").optional().trim(),
];

export const createMaintenanceValidator = [
  body("generatorId").isMongoId().withMessage("generatorId must be a valid id"),
  body("description").trim().notEmpty().withMessage("description is required"),
  body("scheduledDate").isISO8601().withMessage("scheduledDate is required and must be a valid date"),
  body("intervalDays").optional().isInt({ min: 1 }).withMessage("intervalDays must be a whole number of days, 1 or more"),
  ...maintenanceOptionalFields,
  runValidation,
];

// PATCH does one of three things: edit a job, cancel it (status "cancelled"),
// or complete it (status "completed"). Completing goes through its own
// service operation, so it must not be mixed with schedule edits.
const EDIT_ONLY_FIELDS = ["description", "type", "scheduledDate", "intervalDays", "alertThresholdDays"];

export const updateMaintenanceValidator = [
  body("status")
    .optional()
    .isIn(["completed", "cancelled"])
    .withMessage('status can only be set to "completed" or "cancelled"')
    .bail()
    .custom((status, { req }) => {
      if (status !== "completed") return true;
      const clash = EDIT_ONLY_FIELDS.filter((f) => req.body[f] !== undefined);
      if (clash.length) throw new Error(`Complete a job on its own; to change ${clash.join(", ")}, send a separate request`);
      return true;
    }),
  body("completedDate")
    .optional()
    .isISO8601()
    .withMessage("completedDate must be a valid date")
    .bail()
    .custom((_, { req }) => {
      if (req.body.status !== "completed") throw new Error('completedDate can only be sent together with status "completed"');
      return true;
    }),
  body("description").optional().trim().notEmpty().withMessage("description cannot be empty"),
  body("scheduledDate").optional().isISO8601().withMessage("scheduledDate must be a valid date"),
  body("intervalDays").optional({ nullable: true }).isInt({ min: 1 }).withMessage("intervalDays must be a whole number of days, 1 or more (or null to stop repeating)"),
  ...maintenanceOptionalFields,
  runValidation,
];

export const maintenanceAlertsValidator = [
  // No .toInt(): in Express 5 req.query is read-only, so a sanitizer can't write
  // the converted value back. The controller converts it with Number().
  query("withinDays").optional().isInt({ min: 0, max: 365 }).withMessage("withinDays must be a whole number between 0 and 365"),
  runValidation,
];

export const updateGeneratorValidator = [
  body("tag").optional().trim().notEmpty().withMessage("tag cannot be empty"),
  body("name").optional().trim().notEmpty().withMessage("name cannot be empty"),
  ...optionalFields,
  runValidation,
];

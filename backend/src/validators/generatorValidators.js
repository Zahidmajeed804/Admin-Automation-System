import { body } from "express-validator";
import { runValidation } from "./authValidators.js";

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
  body("reason").optional().trim(),
  body("notes").optional().trim(),
  runValidation,
];

export const updateGeneratorValidator = [
  body("tag").optional().trim().notEmpty().withMessage("tag cannot be empty"),
  body("name").optional().trim().notEmpty().withMessage("name cannot be empty"),
  ...optionalFields,
  runValidation,
];

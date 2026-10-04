import { body, param, query } from "express-validator";
import { runValidation } from "../middleware/runValidation.js";

// Kept in sync with the min/max on models/Designation.js.
const SHIFT_HOURS_RANGE = { min: 1, max: 16 };
const shiftHoursMessage = `shiftHours must be a number between ${SHIFT_HOURS_RANGE.min} and ${SHIFT_HOURS_RANGE.max}`;

export const listDesignationValidator = [
  query("status").optional().isIn(["active", "inactive"]).withMessage("status must be active or inactive"),
  runValidation,
];

export const createDesignationValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .bail()
    .isLength({ max: 60 })
    .withMessage("Name must be at most 60 characters"),
  body("shiftHours").isFloat(SHIFT_HOURS_RANGE).withMessage(shiftHoursMessage).toFloat(),
  runValidation,
];

export const updateDesignationValidator = [
  param("id").isMongoId().withMessage("id must be a valid designation id"),
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .bail()
    .isLength({ max: 60 })
    .withMessage("Name must be at most 60 characters"),
  body("shiftHours").optional().isFloat(SHIFT_HOURS_RANGE).withMessage(shiftHoursMessage).toFloat(),
  body("isActive").optional().isBoolean().withMessage("isActive must be true or false").toBoolean(),
  runValidation,
];

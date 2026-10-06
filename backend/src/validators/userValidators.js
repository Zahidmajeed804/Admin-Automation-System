import { body, param, query } from "express-validator";
import { runValidation } from "../middleware/runValidation.js";
import {
  EMPLOYEE_ID_PATTERN,
  employeeIdMessage,
  optionalEmail,
  requiredPhone,
  optionalPhone,
} from "./contactFields.js";

// Yearly day counts for the types that are actually limited (unpaid leave has no
// allocation). Shared by create and update — both accept the whole object or leave
// it out entirely, in which case the schema default (0) applies.
const leaveAllocationFields = [
  body("leaveAllocation").optional().isObject().withMessage("leaveAllocation must be an object"),
  body("leaveAllocation.casual")
    .optional()
    .isInt({ min: 0 })
    .withMessage("leaveAllocation.casual must be a non-negative integer"),
  body("leaveAllocation.sick")
    .optional()
    .isInt({ min: 0 })
    .withMessage("leaveAllocation.sick must be a non-negative integer"),
  body("leaveAllocation.annual")
    .optional()
    .isInt({ min: 0 })
    .withMessage("leaveAllocation.annual must be a non-negative integer"),
];

// Staff created by an admin: Employee ID and phone required, email optional (AAS-468).
export const createUserValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  optionalEmail(),
  body("employeeId")
    .trim()
    .notEmpty()
    .withMessage("Employee ID is required")
    .bail()
    .matches(EMPLOYEE_ID_PATTERN)
    .withMessage(employeeIdMessage),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/\d/)
    .withMessage("Password must contain at least one number"),
  requiredPhone(),
  body("department").optional().trim(),
  body("designationId").optional({ values: "falsy" }).isMongoId().withMessage("designationId must be a valid id"),
  ...leaveAllocationFields,
  runValidation,
];

// "" for email or phone removes it (see userService.update).
export const updateUserValidator = [
  param("id").isMongoId().withMessage("id must be a valid user id"),
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  optionalEmail(),
  body("employeeId")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Employee ID cannot be empty")
    .bail()
    .matches(EMPLOYEE_ID_PATTERN)
    .withMessage(employeeIdMessage),
  optionalPhone(),
  body("department").optional().trim(),
  // null or "" clears the designation (see userService.update).
  body("designationId").optional({ values: "falsy" }).isMongoId().withMessage("designationId must be a valid id"),
  ...leaveAllocationFields,
  runValidation,
];

export const listUserValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("pageSize").optional().isInt({ min: 1, max: 100 }).withMessage("pageSize must be between 1 and 100"),
  query("status").optional().isIn(["active", "inactive"]).withMessage("status must be active or inactive"),
  query("search").optional().trim(),
  runValidation,
];

export const setUserStatusValidator = [
  param("id").isMongoId().withMessage("id must be a valid user id"),
  body("isActive").isBoolean().withMessage("isActive must be true or false").toBoolean(),
  runValidation,
];

export const assignLeaveAllocationAllValidator = [
  body("casual").isInt({ min: 0 }).withMessage("casual must be a non-negative integer").toInt(),
  body("sick").isInt({ min: 0 }).withMessage("sick must be a non-negative integer").toInt(),
  body("annual").isInt({ min: 0 }).withMessage("annual must be a non-negative integer").toInt(),
  body("overwrite").optional().isBoolean().withMessage("overwrite must be true or false").toBoolean(),
  // Omitted, null or "" = every active staff member.
  body("designationId").optional({ values: "falsy" }).isMongoId().withMessage("designationId must be a valid id"),
  runValidation,
];

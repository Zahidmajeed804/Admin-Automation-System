import { body, param, query } from "express-validator";
import { runValidation } from "../middleware/runValidation.js";

// Admin-typed, not auto-generated — see AAS-383. Letters, numbers and hyphens
// keep it URL/filename-safe wherever it's displayed or exported later.
const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9-]{2,20}$/;
const employeeIdMessage = "Employee ID must be 2-20 letters, numbers or hyphens";

export const createUserValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").trim().isEmail().withMessage("A valid email is required").normalizeEmail(),
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
  body("phone").optional().trim(),
  body("department").optional().trim(),
  runValidation,
];

export const updateUserValidator = [
  param("id").isMongoId().withMessage("id must be a valid user id"),
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("email").optional().trim().isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("employeeId")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Employee ID cannot be empty")
    .bail()
    .matches(EMPLOYEE_ID_PATTERN)
    .withMessage(employeeIdMessage),
  body("phone").optional().trim(),
  body("department").optional().trim(),
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

import { body, query } from "express-validator";
import { runValidation } from "./authValidators.js";

export const createItemValidator = [
  body("itemName").trim().notEmpty().withMessage("Item name is required"),
  body("sku").trim().notEmpty().withMessage("SKU is required"),
  body("category").trim().notEmpty().withMessage("Category is required"),
  body("unitPrice").isFloat({ min: 0 }).withMessage("Unit price must be a positive number"),
  body("vendor").optional().trim(),
  body("openingStock").isInt({ min: 0 }).withMessage("Opening stock must be a non-negative integer"),
  body("minimumStock").isInt({ min: 0 }).withMessage("Minimum stock must be a non-negative integer"),
  runValidation,
];

export const updateItemValidator = [
  body("itemName").optional().trim().notEmpty(),
  body("category").optional().trim().notEmpty(),
  body("unitPrice").optional().isFloat({ min: 0 }),
  body("vendor").optional().trim(),
  body("minimumStock").optional().isInt({ min: 0 }),
  runValidation,
];

export const stockAdjustValidator = [
  body("quantity").isInt({ min: 1 }).withMessage("Quantity must be a positive integer"),
  body("remarks").optional().trim(),
  runValidation,
];

export const issueValidator = [
  body("itemId").notEmpty().withMessage("Item is required"),
  body("date").optional().isISO8601().withMessage("Date must be valid"),
  body("employeeName").trim().notEmpty().withMessage("Employee name is required"),
  body("department").optional().trim(),
  body("eventName").optional().trim(),
  body("quantity").isInt({ min: 1 }).withMessage("Quantity must be a positive integer"),
  body("approvedBy").optional().trim(),
  body("remarks").optional().trim(),
  runValidation,
];

export const listItemsQueryValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  runValidation,
];

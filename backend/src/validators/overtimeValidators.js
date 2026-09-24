import { body, param, query } from "express-validator";
import { runValidation } from "../middleware/runValidation.js";
import { OVERTIME_STATUSES, REVIEW_DECISIONS } from "../constants/attendance.js";

export const listOvertimeValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("pageSize")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("pageSize must be between 1 and 100"),
  query("status")
    .optional()
    .isIn(OVERTIME_STATUSES)
    .withMessage(`status must be one of: ${OVERTIME_STATUSES.join(", ")}`),
  query("userId").optional().isMongoId().withMessage("userId must be a valid id"),
  query("startDate").optional().isISO8601().withMessage("startDate must be a valid date"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("endDate must be a valid date")
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
        throw new Error("endDate must not be before startDate");
      }
      return true;
    }),
  runValidation,
];

export const reviewOvertimeValidator = [
  param("id").isMongoId().withMessage("id must be a valid overtime request id"),
  body("decision")
    .exists({ checkNull: true })
    .withMessage("decision is required")
    .bail()
    .isIn(REVIEW_DECISIONS)
    .withMessage(`decision must be one of: ${REVIEW_DECISIONS.join(", ")}`),
  body("note")
    .optional()
    .isString()
    .withMessage("note must be text")
    .trim()
    .isLength({ max: 500 })
    .withMessage("note must be 500 characters or fewer"),
  runValidation,
];

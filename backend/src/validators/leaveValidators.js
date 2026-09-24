import { body, param, query } from "express-validator";
import { runValidation } from "../middleware/runValidation.js";
import { LEAVE_TYPES, LEAVE_STATUSES, REVIEW_DECISIONS } from "../constants/attendance.js";

const typeMessage = `leaveType must be one of: ${LEAVE_TYPES.join(", ")}`;

export const createLeaveValidator = [
  body("leaveType").exists({ checkNull: true }).withMessage("leaveType is required").bail().isIn(LEAVE_TYPES).withMessage(typeMessage),
  body("startDate").exists({ checkNull: true }).withMessage("startDate is required").bail().isISO8601().withMessage("startDate must be a valid date"),
  body("endDate")
    .exists({ checkNull: true })
    .withMessage("endDate is required")
    .bail()
    .isISO8601()
    .withMessage("endDate must be a valid date")
    .bail()
    .custom((value, { req }) => {
      if (req.body.startDate && new Date(value) < new Date(req.body.startDate)) {
        throw new Error("endDate must not be before startDate");
      }
      return true;
    }),
  body("reason")
    .optional()
    .isString()
    .withMessage("reason must be text")
    .trim()
    .isLength({ max: 500 })
    .withMessage("reason must be 500 characters or fewer"),
  runValidation,
];

export const listLeaveValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("pageSize")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("pageSize must be between 1 and 100"),
  query("status")
    .optional()
    .isIn(LEAVE_STATUSES)
    .withMessage(`status must be one of: ${LEAVE_STATUSES.join(", ")}`),
  query("leaveType").optional().isIn(LEAVE_TYPES).withMessage(typeMessage),
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

export const reviewLeaveValidator = [
  param("id").isMongoId().withMessage("id must be a valid leave request id"),
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

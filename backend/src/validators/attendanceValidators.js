import { body, param, query } from "express-validator";
import { runValidation } from "../middleware/runValidation.js";
import { ATTENDANCE_STATUSES } from "../constants/attendance.js";

// Clock-in/clock-out act on the authenticated user (req.userId) and take no
// body — these chains exist so the route wiring is consistent with every
// other module, and so future fields (e.g. a location/note) have somewhere
// to be added without touching the route.
export const clockInValidator = [runValidation];

export const clockOutValidator = [runValidation];

const EDITABLE_FIELDS = ["clockIn", "clockOut", "status", "notes"];

export const updateAttendanceValidator = [
  param("id").isMongoId().withMessage("id must be a valid attendance record id"),
  body("clockIn").optional().isISO8601().withMessage("clockIn must be a valid date-time"),
  body("clockOut").optional().isISO8601().withMessage("clockOut must be a valid date-time"),
  body("status")
    .optional()
    .isIn(ATTENDANCE_STATUSES)
    .withMessage(`status must be one of: ${ATTENDANCE_STATUSES.join(", ")}`),
  body("notes")
    .optional()
    .isString()
    .withMessage("notes must be text")
    .trim()
    .isLength({ max: 500 })
    .withMessage("notes must be 500 characters or fewer"),
  body().custom((_, { req }) => {
    if (!EDITABLE_FIELDS.some((f) => req.body[f] !== undefined)) {
      throw new Error(`Provide at least one of: ${EDITABLE_FIELDS.join(", ")}`);
    }
    return true;
  }),
  runValidation,
];

export const listAttendanceValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("pageSize")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("pageSize must be between 1 and 100"),
  query("status")
    .optional()
    .isIn(ATTENDANCE_STATUSES)
    .withMessage(`status must be one of: ${ATTENDANCE_STATUSES.join(", ")}`),
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

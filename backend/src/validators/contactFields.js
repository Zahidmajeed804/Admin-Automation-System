import { body } from "express-validator";
import { isValidPhone } from "../utils/phone.js";

// Admin-typed, not auto-generated — see AAS-383. Letters, numbers and hyphens
// keep it URL/filename-safe wherever it's displayed or exported later.
export const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9-]{2,20}$/;
export const employeeIdMessage = "Employee ID must be 2-20 letters, numbers or hyphens";

const phoneMessage = "Enter a valid phone number, e.g. 0300 1234567 or +92 300 1234567";

// Contact fields shared by self-registration and admin staff creation/editing.
// "" counts as "not given" for the optional ones (forms send empty strings); on an
// update, userService treats "" as "remove it".

export const optionalEmail = () =>
  body("email")
    .optional({ values: "falsy" })
    .trim()
    .isEmail()
    .withMessage("Enter a valid email address")
    .normalizeEmail();

export const requiredPhone = () =>
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .bail()
    .custom(isValidPhone)
    .withMessage(phoneMessage);

export const optionalPhone = () =>
  body("phone").optional({ values: "falsy" }).trim().custom(isValidPhone).withMessage(phoneMessage);

export const optionalEmployeeId = () =>
  body("employeeId").optional({ values: "falsy" }).trim().matches(EMPLOYEE_ID_PATTERN).withMessage(employeeIdMessage);

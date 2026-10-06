import { body } from "express-validator";
import { runValidation } from "../middleware/runValidation.js";
import { optionalEmail, requiredPhone, optionalEmployeeId } from "./contactFields.js";

// Self-registration (AAS-468): name, phone and password are required; email and
// Employee ID are optional.
export const registerValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  requiredPhone(),
  optionalEmail(),
  optionalEmployeeId(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/\d/)
    .withMessage("Password must contain at least one number"),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),
  runValidation,
];

// One field: phone number, Employee ID or email. Older clients still send `email`,
// which is accepted as the identifier. An email is normalized exactly as it was when
// stored (normalizeEmail on register / staff create), so the lookup matches.
export const loginValidator = [
  body("identifier").customSanitizer((value, { req }) => String(value ?? req.body.email ?? "").trim()),
  body("identifier").notEmpty().withMessage("Phone, Employee ID or email is required"),
  body("identifier")
    .if((value) => String(value).includes("@"))
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  runValidation,
];

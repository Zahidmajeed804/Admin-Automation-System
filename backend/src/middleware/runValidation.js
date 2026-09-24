import { validationResult } from "express-validator";
import { BadRequestError } from "../errors/AppError.js";

// Last step of every validator chain: collects all express-validator errors into one 400
// whose `details` lists each failing field.
export const runValidation = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw new BadRequestError(
      "Validation failed",
      result.array().map((e) => ({ field: e.path, message: e.msg }))
    );
  }
  next();
};

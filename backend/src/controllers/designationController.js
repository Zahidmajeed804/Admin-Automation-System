import { designationService } from "../services/designationService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const designationController = {
  list: asyncHandler(async (req, res) => {
    const designations = await designationService.list({ status: req.query.status });
    sendSuccess(res, { message: "Designations", data: { designations } });
  }),

  create: asyncHandler(async (req, res) => {
    const { name, shiftHours } = req.body;
    const designation = await designationService.create({ name, shiftHours });
    sendSuccess(res, {
      statusCode: 201,
      message: "Designation created",
      data: { designation },
    });
  }),

  update: asyncHandler(async (req, res) => {
    const { name, shiftHours, isActive } = req.body;
    const designation = await designationService.update(req.params.id, { name, shiftHours, isActive });
    sendSuccess(res, { message: "Designation updated", data: { designation } });
  }),
};

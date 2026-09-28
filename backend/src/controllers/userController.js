import { userRepository } from "../repositories/userRepository.js";
import { userService } from "../services/userService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const userController = {
  // Lightweight employee picker for the Team Overtime/Leave filters — not the
  // full search/paginated directory, so reviewers who lack users.manage can
  // still use it (see requireAnyPermission on this route).
  options: asyncHandler(async (req, res) => {
    const users = await userRepository.listAll();
    sendSuccess(res, { message: "Employee options", data: { users } });
  }),

  list: asyncHandler(async (req, res) => {
    const { search, status, page, pageSize } = req.query;
    const { items, pagination } = await userService.list({ search, status, page, pageSize });
    sendSuccess(res, {
      message: "Staff members",
      data: { users: items },
      meta: pagination,
    });
  }),

  create: asyncHandler(async (req, res) => {
    const { name, email, employeeId, password, phone, department, leaveAllocation } = req.body;
    const user = await userService.create({ name, email, employeeId, password, phone, department, leaveAllocation });
    sendSuccess(res, {
      statusCode: 201,
      message: "Staff member created",
      data: { user },
    });
  }),

  update: asyncHandler(async (req, res) => {
    const { name, email, employeeId, phone, department, leaveAllocation } = req.body;
    const user = await userService.update(req.params.id, {
      name,
      email,
      employeeId,
      phone,
      department,
      leaveAllocation,
    });
    sendSuccess(res, {
      message: "Staff member updated",
      data: { user },
    });
  }),

  setStatus: asyncHandler(async (req, res) => {
    const user = await userService.setActive(req.params.id, req.body.isActive, req.userId);
    sendSuccess(res, {
      message: user.isActive ? "Staff member activated" : "Staff member deactivated",
      data: { user },
    });
  }),

  assignLeaveAllocationToAll: asyncHandler(async (req, res) => {
    const { casual, sick, annual, overwrite } = req.body;
    const result = await userService.assignLeaveAllocationToAll({
      casual,
      sick,
      annual,
      overwrite: Boolean(overwrite),
    });
    sendSuccess(res, {
      message: `Leave allocation applied to ${result.modified} of ${result.matched} matching staff member(s)`,
      data: result,
    });
  }),
};

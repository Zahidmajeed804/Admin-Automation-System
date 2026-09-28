import { userService } from "../services/userService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const userController = {
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
    const { name, email, employeeId, password, phone, department } = req.body;
    const user = await userService.create({ name, email, employeeId, password, phone, department });
    sendSuccess(res, {
      statusCode: 201,
      message: "Staff member created",
      data: { user },
    });
  }),

  update: asyncHandler(async (req, res) => {
    const { name, email, employeeId, phone, department } = req.body;
    const user = await userService.update(req.params.id, { name, email, employeeId, phone, department });
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
};

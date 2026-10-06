import { authService } from "../services/authService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const authController = {
  register: asyncHandler(async (req, res) => {
    const { name, email, password, phone, employeeId, department } = req.body;
    const { user, token, roles, permissions } = await authService.register({
      name,
      email,
      password,
      phone,
      employeeId,
      department,
    });
    sendSuccess(res, {
      statusCode: 201,
      message: "Account created successfully",
      data: { user, token, roles, permissions },
    });
  }),

  login: asyncHandler(async (req, res) => {
    // `email` is the field older clients send; loginValidator copies it into `identifier`.
    const { identifier, password } = req.body;
    const { user, token, roles, permissions } = await authService.login({ identifier, password });
    sendSuccess(res, {
      message: "Logged in successfully",
      data: { user, token, roles, permissions },
    });
  }),

  me: asyncHandler(async (req, res) => {
    const { user, roles, permissions } = await authService.getCurrentUser(req.userId);
    sendSuccess(res, {
      message: "Current user",
      data: { user, roles, permissions },
    });
  }),
};

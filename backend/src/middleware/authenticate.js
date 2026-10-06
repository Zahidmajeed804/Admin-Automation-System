import { verifyToken } from "../utils/jwt.js";
import { userRepository } from "../repositories/userRepository.js";
import { UnauthorizedError } from "../errors/AppError.js";
import { asyncHandler } from "./asyncHandler.js";

/**
 * Verifies the Bearer token and loads the user onto req.user.
 * Every protected route must apply this before requirePermission.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new UnauthorizedError("Authentication token missing");
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  const user = await userRepository.findById(payload.sub);
  if (!user) {
    throw new UnauthorizedError("User not found");
  }
  // The token itself is still valid, but the account was deactivated after it was
  // issued (see userService.setActive). There is no server-side token revocation
  // list — this per-request check is what makes deactivation take effect immediately,
  // on the very next call, instead of waiting for the token to expire.
  if (!user.isActive) {
    throw new UnauthorizedError("Your account has been deactivated. Contact an administrator.");
  }

  req.user = user;
  req.userId = user._id.toString();
  next();
});

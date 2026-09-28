import { Router } from "express";
import { userController } from "../controllers/userController.js";
import {
  createUserValidator,
  updateUserValidator,
  listUserValidator,
  setUserStatusValidator,
} from "../validators/userValidators.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission, requireAnyPermission } from "../authorization/requirePermission.js";

const router = Router();

router.use(authenticate);

// Employee picker for the Team Overtime/Leave filters: any reviewer needs this,
// not just users.manage, so it's gated separately before the blanket check below.
router.get(
  "/options",
  requireAnyPermission(["overtime.approve", "leave.approve"]),
  userController.options
);

// Staff onboarding is admin-only: every route below needs the database-resolved
// "users.manage" permission, never a hardcoded role check.
router.use(requirePermission("users.manage"));

router.get("/", listUserValidator, userController.list);
router.post("/", createUserValidator, userController.create);
router.patch("/:id", updateUserValidator, userController.update);
router.patch("/:id/status", setUserStatusValidator, userController.setStatus);

export default router;

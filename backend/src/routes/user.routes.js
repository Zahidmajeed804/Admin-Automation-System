import { Router } from "express";
import { userController } from "../controllers/userController.js";
import {
  createUserValidator,
  updateUserValidator,
  listUserValidator,
  setUserStatusValidator,
} from "../validators/userValidators.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../authorization/requirePermission.js";

const router = Router();

// Staff onboarding is admin-only: every route needs the database-resolved
// "users.manage" permission, never a hardcoded role check.
router.use(authenticate);
router.use(requirePermission("users.manage"));

router.get("/", listUserValidator, userController.list);
router.post("/", createUserValidator, userController.create);
router.patch("/:id", updateUserValidator, userController.update);
router.patch("/:id/status", setUserStatusValidator, userController.setStatus);

export default router;
